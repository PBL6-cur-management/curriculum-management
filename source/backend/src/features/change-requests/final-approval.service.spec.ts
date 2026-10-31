import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChangeRequestStatus,
  ChangeRequestType,
  ScopeSource,
  ScopeType,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { ApprovalRecorder } from '../../shared/change-requests/approval-recorder.js';
import type { RequestNotifier } from '../../shared/change-requests/request-notifier.js';
import type { StaleChecker } from '../../shared/change-requests/stale-checker.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import type { FinalApprovalApplier } from './final-approval.applier.js';
import type { FinalApprovalPreviewReader } from './final-approval.preview.js';
import { FinalApprovalService } from './final-approval.service.js';

const OFFICE = new AccessContext('office', [
  {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R1',
    roleName: 'R1',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.SYSTEM,
    scopeUnit: null,
    scope: { all: true },
    permissions: new Map([
      [PERMISSIONS.CHANGE_REQUEST_VIEW, { mode: 'DIRECT', scope: 'ALL' }],
    ]),
  } satisfies ActiveAssignment,
]);

const request = {
  id: 'r1',
  requestCode: 'DX-2026-0001',
  requestType: ChangeRequestType.CURRICULUM,
  targetType: 'PROGRAM',
  status: ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
  submissionRound: 1,
  createdById: 'author',
  createdByAcademicOffice: false,
  title: 'Đề xuất',
  origin: 'FACULTY',
  basisDocumentNumber: null,
  programId: 'p1',
  courseId: null,
  subjectGroupId: null,
};

const dto = {
  decisionNumber: 'QD-9',
  signedDate: '2026-10-01',
  effectiveSemesterId: 'sem',
};
const FUTURE = new Date('2099-01-01T00:00:00.000Z');
const PAST = new Date('2020-01-01T00:00:00.000Z');

describe('FinalApprovalService', () => {
  let calls: string[];
  let db: {
    changeRequest: {
      findFirst: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    semester: { findUnique: ReturnType<typeof vi.fn> };
    changeItem: { count: ReturnType<typeof vi.fn> };
    $executeRaw: ReturnType<typeof vi.fn>;
  };
  let recorder: Record<string, ReturnType<typeof vi.fn>>;
  let stale: { isStale: ReturnType<typeof vi.fn> };
  let applier: { apply: ReturnType<typeof vi.fn> };
  let notifier: Record<string, ReturnType<typeof vi.fn>>;
  let previews: { read: ReturnType<typeof vi.fn> };
  let details: { read: ReturnType<typeof vi.fn> };
  let service: FinalApprovalService;

  const step = (name: string) => () => {
    calls.push(name);
    return Promise.resolve(undefined);
  };

  beforeEach(() => {
    calls = [];
    db = {
      changeRequest: {
        findFirst: vi.fn().mockResolvedValue({ ...request }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...request }),
        update: vi.fn(step('update')),
      },
      semester: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sem',
          semesterCode: '2099-1',
          startDate: FUTURE,
        }),
      },
      changeItem: { count: vi.fn().mockResolvedValue(0) },
      $executeRaw: vi.fn(step('graph-lock')),
    };
    recorder = {
      claim: vi.fn(step('claim')),
      actionableRows: vi.fn().mockResolvedValue([{ id: 'row' }]),
      record: vi.fn(step('record')),
      close: vi.fn(step('close')),
    };
    stale = { isStale: vi.fn().mockResolvedValue(false) };
    applier = {
      apply: vi.fn(() => {
        calls.push('apply');
        return Promise.resolve([{ status: 'ACTIVE' }]);
      }),
    };
    notifier = {
      approved: vi.fn(step('approved')),
      effective: vi.fn(step('effective')),
    };
    previews = { read: vi.fn().mockResolvedValue({ requestId: 'r1' }) };
    details = { read: vi.fn().mockResolvedValue({ id: 'r1' }) };
    const prisma = {
      approvalDelegation: { findMany: vi.fn().mockResolvedValue([]) },
      ...db,
      $transaction: vi.fn((run: (tx: unknown) => unknown) => run(db)),
    };
    service = new FinalApprovalService(
      prisma as unknown as PrismaService,
      recorder as unknown as ApprovalRecorder,
      stale as unknown as StaleChecker,
      applier as unknown as FinalApprovalApplier,
      notifier as unknown as RequestNotifier,
      previews as unknown as FinalApprovalPreviewReader,
      details as unknown as ChangeRequestDetailReader,
    );
  });

  describe('approve', () => {
    it('claims, applies before it records, then closes Effective, telling the creator both events once each', async () => {
      await service.approve('r1', dto, OFFICE);

      expect(calls).toEqual([
        'claim',
        'graph-lock',
        'apply',
        'record',
        'update',
        'close',
        'approved',
        'effective',
      ]);
      expect(recorder.record).toHaveBeenCalledWith(expect.anything(), ['row'], {
        action: 'APPROVE',
        remark: null,
        performedById: 'office',
        isOverride: false,
      });
      expect(recorder.close).toHaveBeenCalledWith(
        expect.anything(),
        'r1',
        'EFFECTIVE',
      );
      expect(db.changeRequest.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          decisionNumber: 'QD-9',
          signedDate: new Date('2026-10-01T00:00:00.000Z'),
          effectiveSemesterId: 'sem',
          pastSemesterAllowed: false,
        },
      });
      expect(details.read).toHaveBeenCalledWith('r1', OFFICE);
    });

    it('stays Approved, with no effective notice, while a created version waits for its semester', async () => {
      applier.apply.mockResolvedValue([
        { status: 'ACTIVE' },
        { status: 'PENDING' },
      ]);

      await service.approve('r1', dto, OFFICE);

      expect(recorder.close).toHaveBeenCalledWith(
        expect.anything(),
        'r1',
        'APPROVED',
      );
      expect(notifier.approved).toHaveBeenCalledTimes(1);
      expect(notifier.effective).not.toHaveBeenCalled();
    });

    it('is Effective at once for a request that creates no version (catalog changes)', async () => {
      applier.apply.mockResolvedValue([]);

      await service.approve('r1', dto, OFFICE);

      expect(recorder.close).toHaveBeenCalledWith(
        expect.anything(),
        'r1',
        'EFFECTIVE',
      );
    });

    it('leaves the request pending when applying it fails: nothing recorded, closed or sent', async () => {
      applier.apply.mockRejectedValue(
        Object.assign(new Error('x'), { code: 'ITEM_APPLY_FAILED' }),
      );

      await expect(service.approve('r1', dto, OFFICE)).rejects.toThrow('x');

      expect(recorder.record).not.toHaveBeenCalled();
      expect(recorder.close).not.toHaveBeenCalled();
      expect(notifier.approved).not.toHaveBeenCalled();
    });

    it('refuses a stale base before applying anything', async () => {
      stale.isStale.mockResolvedValue(true);

      await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
        code: 'STALE_BASE',
      });
      expect(applier.apply).not.toHaveBeenCalled();
    });

    it('lets the second of two simultaneous approvers lose at the claim', async () => {
      recorder.claim.mockRejectedValue(
        Object.assign(new Error('moved'), { code: 'REQUEST_STATE_CHANGED' }),
      );

      await expect(service.approve('r1', dto, OFFICE)).rejects.toThrow('moved');
      expect(applier.apply).not.toHaveBeenCalled();
    });

    it('refuses someone who has no row to decide', async () => {
      recorder.actionableRows.mockResolvedValue([]);

      await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
        code: 'NOT_YOUR_STEP',
      });
      expect(applier.apply).not.toHaveBeenCalled();
    });

    describe('the semester', () => {
      it('needs a known start and a known semester', async () => {
        db.semester.findUnique.mockResolvedValueOnce({
          id: 'sem',
          startDate: null,
        });
        await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
          code: 'SEMESTER_START_UNKNOWN',
        });
        db.semester.findUnique.mockResolvedValueOnce(null);
        await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
          code: 'SEMESTER_NOT_FOUND',
        });
      });

      it('refuses a semester that has begun unless the academic office made the request and said so', async () => {
        db.semester.findUnique.mockResolvedValue({
          id: 'sem',
          semesterCode: 'old',
          startDate: PAST,
        });

        await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
          code: 'SEMESTER_ALREADY_STARTED',
        });
        await expect(
          service.approve('r1', { ...dto, allowPastSemester: true }, OFFICE),
        ).rejects.toMatchObject({ code: 'SEMESTER_ALREADY_STARTED' });
        expect(applier.apply).not.toHaveBeenCalled();
      });

      it('takes a past semester for a request the academic office created, and records that it did', async () => {
        db.semester.findUnique.mockResolvedValue({
          id: 'sem',
          semesterCode: 'old',
          startDate: PAST,
        });
        db.changeRequest.findUniqueOrThrow.mockResolvedValue({
          ...request,
          createdByAcademicOffice: true,
        });

        await service.approve(
          'r1',
          { ...dto, allowPastSemester: true },
          OFFICE,
        );

        expect(
          db.changeRequest.update.mock.calls[0][0].data.pastSemesterAllowed,
        ).toBe(true);
      });

      it('refuses a started semester for grading changes even from the academic office with the flag set', async () => {
        db.semester.findUnique.mockResolvedValue({
          id: 'sem',
          semesterCode: 'old',
          startDate: PAST,
        });
        db.changeRequest.findUniqueOrThrow.mockResolvedValue({
          ...request,
          requestType: ChangeRequestType.OUTCOME,
          createdByAcademicOffice: true,
        });
        db.changeItem.count.mockResolvedValue(2);

        await expect(
          service.approve('r1', { ...dto, allowPastSemester: true }, OFFICE),
        ).rejects.toMatchObject({ code: 'SEMESTER_ALREADY_STARTED' });
        expect(applier.apply).not.toHaveBeenCalled();
        expect(db.changeItem.count).toHaveBeenCalledWith({
          where: {
            changeRequestId: 'r1',
            entityType: { in: ['FORMULA', 'COMPONENT', 'CLO_MAPPING'] },
          },
        });
      });

      it('lets a grading change into a future semester', async () => {
        db.changeItem.count.mockResolvedValue(1);

        await service.approve('r1', dto, OFFICE);

        expect(applier.apply).toHaveBeenCalled();
      });

      it('never marks a future semester as past, whatever the flag says', async () => {
        db.changeRequest.findUniqueOrThrow.mockResolvedValue({
          ...request,
          createdByAcademicOffice: true,
        });

        await service.approve(
          'r1',
          { ...dto, allowPastSemester: true },
          OFFICE,
        );

        expect(
          db.changeRequest.update.mock.calls[0][0].data.pastSemesterAllowed,
        ).toBe(false);
      });
    });
  });

  describe('who may call', () => {
    it('keeps organisational requests on the plain approve', async () => {
      db.changeRequest.findFirst.mockResolvedValue({
        ...request,
        requestType: ChangeRequestType.ORGANIZATION,
      });
      await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
        code: 'FINAL_APPROVAL_NOT_APPLICABLE',
      });
      await expect(service.preview('r1', OFFICE)).rejects.toMatchObject({
        code: 'FINAL_APPROVAL_NOT_APPLICABLE',
      });
    });

    it('lets a grading-formula request reach final approval', async () => {
      db.changeRequest.findFirst.mockResolvedValue({
        ...request,
        requestType: ChangeRequestType.GRADING_FORMULA,
      });
      await expect(service.approve('r1', dto, OFFICE)).resolves.toEqual({
        id: 'r1',
      });
    });

    it('refuses the creator, even a creator who is in the academic office', async () => {
      db.changeRequest.findFirst.mockResolvedValue({
        ...request,
        createdById: 'office',
      });

      await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
        code: 'SELF_APPROVAL',
      });
    });

    it('refuses a request that is not waiting at level 3', async () => {
      for (const status of [
        ChangeRequestStatus.PENDING_DIRECTOR,
        ChangeRequestStatus.DRAFT,
        ChangeRequestStatus.EFFECTIVE,
      ]) {
        db.changeRequest.findFirst.mockResolvedValue({ ...request, status });
        await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
          code: 'NOT_YOUR_STEP',
        });
      }
    });

    it('answers 404 for a request the caller cannot see', async () => {
      db.changeRequest.findFirst.mockResolvedValue(null);

      await expect(service.approve('r1', dto, OFFICE)).rejects.toMatchObject({
        code: 'REQUEST_NOT_FOUND',
      });
    });
  });

  describe('preview', () => {
    it('shows the nonauthoritative preview only to someone with a row to decide', async () => {
      expect(await service.preview('r1', OFFICE)).toEqual({ requestId: 'r1' });

      recorder.actionableRows.mockResolvedValue([]);
      await expect(service.preview('r1', OFFICE)).rejects.toMatchObject({
        code: 'NOT_YOUR_STEP',
      });
      expect(previews.read).toHaveBeenCalledTimes(1);
    });
  });
});
