import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApprovalAction,
  ChangeRequestStatus,
  ChangeRequestType,
  ChangeTargetType,
  RequestOrigin,
} from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { CONSISTENCY_ERRORS } from '../../shared/curriculum/consistency-errors.js';
import type { ConsistencyChecker } from '../../shared/curriculum/consistency-checker.js';
import type { RequestNotifier } from '../../shared/change-requests/request-notifier.js';
import type { StaleChecker } from '../../shared/change-requests/stale-checker.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import type { ChangeRequestsService } from './change-requests.service.js';
import type { RequestItemsService } from './request-items.service.js';
import type { PlannedStep, RoutingPlanner } from './routing-planner.js';
import { SubmissionService } from './submission.service.js';
import type { WorkingCopyService } from './working-copy.service.js';

const ACCESS = new AccessContext('u1', []);

const base = {
  id: 'cr1',
  requestType: ChangeRequestType.CURRICULUM,
  targetType: ChangeTargetType.PROGRAM,
  courseId: null,
  programId: 'p1',
  subjectGroupId: null,
  createdById: 'u1',
  status: ChangeRequestStatus.DRAFT,
  submissionRound: 0,
  origin: RequestOrigin.FACULTY,
  basisDocumentNumber: null,
};

const item = {
  sortOrder: 0,
  entityType: 'CURRICULUM_ITEM',
  itemKey: 'IT1',
  label: 'IT1',
  recordId: null,
  oldValue: null,
  newValue: { plannedSemester: '1' },
  baseVersion: 'v1',
};

const step = (
  level: 1 | 2 | 3,
  patch: Partial<PlannedStep> = {},
): PlannedStep => ({
  approvalLevel: level,
  approverId: level === 3 ? null : `u${level}`,
  forSubjectGroupId: null,
  forProgramId: null,
  isSkipped: false,
  skipReason: null,
  approverName: null,
  scopeLabel: null,
  ...patch,
});

describe('SubmissionService', () => {
  const tx = {
    changeRequest: { updateMany: vi.fn(), update: vi.fn() },
    changeItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    changeRequestDocument: { updateMany: vi.fn() },
    approvalStep: { createMany: vi.fn() },
    programVersion: { findUnique: vi.fn() },
    course: { findUniqueOrThrow: vi.fn() },
    curriculumItem: { findMany: vi.fn() },
    syllabus: { findUnique: vi.fn(), findMany: vi.fn() },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  const prisma = {
    $transaction: vi.fn((run: (client: unknown) => unknown) => run(tx)),
    changeRequest: { findFirst: vi.fn() },
    programVersion: { findUnique: vi.fn() },
    course: { findUniqueOrThrow: vi.fn() },
    curriculumItem: { findMany: vi.fn() },
    syllabus: { findUnique: vi.fn(), findMany: vi.fn() },
  };
  const requests = { findOwnDraft: vi.fn() };
  const items = { current: vi.fn() };
  const stale = { isStale: vi.fn() };
  const checker = { assertPasses: vi.fn(), check: vi.fn() };
  const routing = { plan: vi.fn() };
  const details = { read: vi.fn().mockResolvedValue({ id: 'cr1' }) };
  const notifier = { arrived: vi.fn() };
  const copies = { discard: vi.fn() };
  let service: SubmissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    requests.findOwnDraft.mockResolvedValue(base);
    items.current.mockResolvedValue({ live: true, items: [item] });
    stale.isStale.mockResolvedValue(false);
    checker.assertPasses.mockResolvedValue(undefined);
    checker.check.mockResolvedValue({ issues: [] });
    routing.plan.mockResolvedValue({
      steps: [step(1), step(2), step(3)],
      affectedPrograms: [],
    });
    tx.changeRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.curriculumItem.findMany.mockResolvedValue([]);
    prisma.curriculumItem.findMany.mockResolvedValue([]);
    tx.$queryRaw.mockResolvedValue([]);
    tx.programVersion.findUnique.mockResolvedValue({ id: 'copy1' });
    prisma.programVersion.findUnique.mockResolvedValue({ id: 'copy1' });
    prisma.changeRequest.findFirst.mockResolvedValue({
      ...base,
      status: ChangeRequestStatus.PENDING_COORDINATOR,
      submissionRound: 1,
    });
    service = new SubmissionService(
      prisma as unknown as PrismaService,
      requests as unknown as ChangeRequestsService,
      items as unknown as RequestItemsService,
      stale as unknown as StaleChecker,
      checker as unknown as ConsistencyChecker,
      routing as unknown as RoutingPlanner,
      details as unknown as ChangeRequestDetailReader,
      notifier as unknown as RequestNotifier,
      copies as unknown as WorkingCopyService,
    );
  });

  describe('submit', () => {
    it('claims the round, locks the requisite graph, runs the consistency check, then writes items, documents and rows', async () => {
      const order: string[] = [];
      tx.changeRequest.updateMany.mockImplementation(() => {
        order.push('claim');
        return { count: 1 };
      });
      tx.$executeRaw.mockImplementation(() => {
        order.push('lock');
        return 0;
      });
      checker.assertPasses.mockImplementation(() => order.push('assert'));
      tx.changeItem.createMany.mockImplementation(() => order.push('items'));
      tx.approvalStep.createMany.mockImplementation(() => order.push('steps'));
      await service.submit('cr1', ACCESS);
      expect(order).toEqual(['claim', 'lock', 'assert', 'items', 'steps']);
      expect(checker.assertPasses).toHaveBeenCalledWith('copy1', tx);
      expect(tx.changeRequestDocument.updateMany).toHaveBeenCalledWith({
        where: { changeRequestId: 'cr1', seenInRound: null },
        data: { seenInRound: 1 },
      });
      expect(tx.changeRequest.update).toHaveBeenCalledWith({
        where: { id: 'cr1' },
        data: {
          status: ChangeRequestStatus.PENDING_COORDINATOR,
          levelEnteredAt: expect.any(Date),
        },
      });
      expect(notifier.arrived).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ id: 'cr1', submissionRound: 1 }),
        1,
        'u1',
      );
      const rows = tx.approvalStep.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(3);
      expect(
        rows.every(
          (row: { submissionRound: number }) => row.submissionRound === 1,
        ),
      ).toBe(true);
    });

    it('settles skipped rows at submit and starts at the lowest level that still has someone to wait for', async () => {
      routing.plan.mockResolvedValue({
        steps: [
          step(1, { approverId: null, isSkipped: true, skipReason: 'x' }),
          step(2, { isSkipped: true, skipReason: 'y' }),
          step(3),
        ],
        affectedPrograms: [],
      });
      await service.submit('cr1', ACCESS);
      const rows = tx.approvalStep.createMany.mock.calls[0][0].data;
      expect(rows.map((row: { action: string }) => row.action)).toEqual([
        ApprovalAction.APPROVE,
        ApprovalAction.APPROVE,
        ApprovalAction.PENDING,
      ]);
      expect(rows[0].recordedAt).toBeInstanceOf(Date);
      expect(rows[2].recordedAt).toBeNull();
      expect(tx.changeRequest.update.mock.calls[0][0].data).toEqual({
        status: ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
        levelEnteredAt: expect.any(Date),
      });
      expect(notifier.arrived).toHaveBeenCalledWith(
        tx,
        expect.anything(),
        3,
        'u1',
      );
    });

    it('numbers a resubmission one higher', async () => {
      requests.findOwnDraft.mockResolvedValue({ ...base, submissionRound: 1 });
      await service.submit('cr1', ACCESS);
      expect(tx.changeRequest.updateMany.mock.calls[0][0].data).toEqual({
        submissionRound: 2,
      });
      expect(
        tx.approvalStep.createMany.mock.calls[0][0].data[0].submissionRound,
      ).toBe(2);
    });

    it('does not rewrite stored items of a type that keeps them as authored', async () => {
      requests.findOwnDraft.mockResolvedValue({
        ...base,
        requestType: ChangeRequestType.COURSE_RELATION,
        targetType: ChangeTargetType.COURSE,
        courseId: 'c1',
        programId: null,
      });
      tx.course.findUniqueOrThrow.mockResolvedValue({
        id: 'c1',
        ownerGroupId: null,
        ownerFaculty: { unitCode: 'KHOA_CNTT' },
      });
      items.current.mockResolvedValue({ live: false, items: [item] });
      await service.submit('cr1', ACCESS);
      expect(tx.changeItem.deleteMany).not.toHaveBeenCalled();
      expect(checker.assertPasses).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a stale base',
        () => stale.isStale.mockResolvedValue(true),
        'STALE_BASE',
      ],
      [
        'no changes',
        () => items.current.mockResolvedValue({ live: true, items: [] }),
        'NO_CHANGES',
      ],
      [
        'a framework with errors',
        () =>
          checker.assertPasses.mockRejectedValue(
            new AppException(CONSISTENCY_ERRORS.CONSISTENCY_FAILED),
          ),
        'CONSISTENCY_FAILED',
      ],
      [
        'a race lost to another submit',
        () => tx.changeRequest.updateMany.mockResolvedValue({ count: 0 }),
        'REQUEST_NOT_DRAFT',
      ],
    ])('refuses %s and writes nothing', async (_name, arrange, code) => {
      arrange();
      await expect(service.submit('cr1', ACCESS)).rejects.toMatchObject({
        code,
      });
      expect(tx.approvalStep.createMany).not.toHaveBeenCalled();
      expect(tx.changeRequest.update).not.toHaveBeenCalled();
      expect(notifier.arrived).not.toHaveBeenCalled();
    });
  });

  describe('grade formula gate', () => {
    const gradingRequest = {
      ...base,
      requestType: ChangeRequestType.GRADING_FORMULA,
      targetType: ChangeTargetType.COURSE,
      courseId: 'c1',
      programId: null,
    };
    const COVERED = {
      failingScore: null,
      clos: [{ id: 'k1', cloCode: 'CLO1', sortOrder: 1 }],
      assessmentComponents: [
        {
          id: 'a1',
          componentCode: 'GK',
          weight: '100',
          isConditional: false,
          conditionThreshold: null,
          failingScore: null,
          mappings: [{ cloId: 'k1', cloWeight: null }],
        },
      ],
    };

    beforeEach(() => {
      requests.findOwnDraft.mockResolvedValue(gradingRequest);
      prisma.course.findUniqueOrThrow.mockResolvedValue({
        id: 'c1',
        ownerGroupId: null,
        ownerFaculty: { unitCode: 'KHOA_CNTT' },
      });
      tx.course.findUniqueOrThrow.mockResolvedValue({
        id: 'c1',
        ownerGroupId: null,
        ownerFaculty: { unitCode: 'KHOA_CNTT' },
      });
      tx.syllabus.findUnique.mockImplementation(
        (args: { select: Record<string, unknown> }) =>
          Promise.resolve(
            'sourceRequestId' in args.select
              ? { sourceRequestId: 'cr1' }
              : COVERED,
          ),
      );
    });

    it('blocks submit inside the claimed transaction, locks the copy and stores nothing', async () => {
      tx.syllabus.findUnique.mockImplementation(
        (args: { select: Record<string, unknown> }) =>
          Promise.resolve(
            'sourceRequestId' in args.select
              ? { sourceRequestId: 'cr1', id: 'copy' }
              : { ...COVERED, assessmentComponents: [] },
          ),
      );

      await expect(service.submit('cr1', ACCESS)).rejects.toMatchObject({
        code: 'ASSESSMENT_NOT_READY',
      });
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.changeItem.createMany).not.toHaveBeenCalled();
      expect(tx.approvalStep.createMany).not.toHaveBeenCalled();
    });

    it('blocks a program workspace whose pinned revision has no grade formula', async () => {
      requests.findOwnDraft.mockResolvedValue(base);
      tx.curriculumItem.findMany.mockResolvedValue([
        { courseId: 'c1', syllabusId: 'p1', course: { courseCode: 'IT001' } },
      ]);
      tx.syllabus.findMany.mockResolvedValue([
        {
          id: 'p1',
          courseId: 'c1',
          status: 'PUBLISHED',
          courseDescription: '<p>a</p>',
          objectives: '<p>b</p>',
          ...COVERED,
          assessmentComponents: [],
        },
      ]);

      await expect(service.submit('cr1', ACCESS)).rejects.toMatchObject({
        code: 'ASSESSMENT_NOT_READY',
      });
      expect(tx.approvalStep.createMany).not.toHaveBeenCalled();
    });

    it('submits a complete formula', async () => {
      await service.submit('cr1', ACCESS);

      expect(tx.approvalStep.createMany).toHaveBeenCalled();
    });

    it('reports each uncovered CLO as its own blocker in the preview', async () => {
      prisma.syllabus.findUnique.mockImplementation(
        (args: { select: Record<string, unknown> }) =>
          Promise.resolve(
            'clos' in args.select
              ? {
                  ...COVERED,
                  clos: [
                    ...COVERED.clos,
                    { id: 'k2', cloCode: 'CLO2', sortOrder: 2 },
                  ],
                }
              : { id: 'copy' },
          ),
      );

      const result = await service.preview('cr1', ACCESS);

      expect(
        result.blockingIssues.filter(
          (found) => found.code === 'ASSESSMENT_CLO_UNCOVERED',
        ),
      ).toHaveLength(1);
    });
  });

  describe('preview', () => {
    it('reports every blocker instead of throwing, and still shows the routing it could plan', async () => {
      items.current.mockResolvedValue({ live: true, items: [] });
      stale.isStale.mockResolvedValue(true);
      checker.check.mockResolvedValue({
        issues: [
          { severity: 'ERROR', message: 'Vòng điều kiện' },
          { severity: 'HIGH', message: 'Chênh lệch tín chỉ' },
        ],
      });
      const preview = await service.preview('cr1', ACCESS);
      expect(preview.blockingIssues.map((issue) => issue.code)).toEqual([
        'NO_CHANGES',
        'STALE_BASE',
        'CONSISTENCY_FAILED',
      ]);
      expect(preview.levels.map((level) => level.approvalLevel)).toEqual([
        1, 2, 3,
      ]);
    });

    it('turns a routing refusal into a blocker and propagates anything else', async () => {
      routing.plan.mockRejectedValueOnce(
        new AppException({
          status: 409,
          code: 'NO_OTHER_ACADEMIC_OFFICE',
          message: 'm',
        }),
      );
      const preview = await service.preview('cr1', ACCESS);
      expect(preview.blockingIssues).toEqual([
        { code: 'NO_OTHER_ACADEMIC_OFFICE', message: 'm' },
      ]);
      routing.plan.mockRejectedValueOnce(new Error('boom'));
      await expect(service.preview('cr1', ACCESS)).rejects.toThrow('boom');
    });
  });

  describe('withdraw', () => {
    it('withdraws while no non-skipped row of this round approved', async () => {
      await service.withdraw('cr1', ACCESS);
      expect(tx.changeRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'cr1',
          status: ChangeRequestStatus.PENDING_COORDINATOR,
          submissionRound: 1,
          steps: {
            none: {
              submissionRound: 1,
              action: ApprovalAction.APPROVE,
              isSkipped: false,
            },
          },
        },
        data: { status: ChangeRequestStatus.WITHDRAWN, levelEnteredAt: null },
      });
      expect(copies.discard).toHaveBeenCalledWith(tx, 'cr1');
    });

    it('refuses when the guarded update finds an approval, a finished request or a Draft never submitted', async () => {
      tx.changeRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.withdraw('cr1', ACCESS)).rejects.toMatchObject({
        code: 'WITHDRAW_NOT_ALLOWED',
      });
      for (const patch of [
        { status: ChangeRequestStatus.WITHDRAWN, submissionRound: 1 },
        { status: ChangeRequestStatus.DRAFT, submissionRound: 0 },
      ]) {
        prisma.changeRequest.findFirst.mockResolvedValue({ ...base, ...patch });
        await expect(service.withdraw('cr1', ACCESS)).rejects.toMatchObject({
          code: 'WITHDRAW_NOT_ALLOWED',
        });
      }
    });

    it('is for the creator only', async () => {
      prisma.changeRequest.findFirst.mockResolvedValue({
        ...base,
        createdById: 'someone',
        status: ChangeRequestStatus.PENDING_COORDINATOR,
        submissionRound: 1,
      });
      await expect(service.withdraw('cr1', ACCESS)).rejects.toMatchObject({
        code: 'REQUEST_NOT_CREATOR',
      });
    });
  });
});
