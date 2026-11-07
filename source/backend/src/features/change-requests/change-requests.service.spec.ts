import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChangeRequestStatus,
  ChangeRequestType,
  ChangeTargetType,
  RequestOrigin,
  ScopeSource,
  ScopeType,
  type PermissionMode,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import type { FileStorageService } from '../../shared/files/file-storage.service.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import type { CreateChangeRequestDto } from './change-request.dto.js';
import { ChangeRequestsService } from './change-requests.service.js';
import type { ConflictFinder } from './conflict-finder.js';
import type { RequestTargetResolver } from './request-target.resolver.js';
import type { WorkingCopyService } from './working-copy.service.js';

interface Cell {
  code: PermissionCode;
  mode: PermissionMode;
  all?: boolean;
}

function access(
  userId: string,
  cells: Cell[],
  groupIds: string[] = [],
): AccessContext {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.ASSIGNMENT,
    scopeUnit: null,
    scope: {
      all: false,
      orgUnitIds: new Set(),
      subjectGroupIds: new Set(groupIds),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map(
      cells.map((cell) => [
        cell.code,
        {
          mode: cell.mode,
          scope: cell.all ? ('ALL' as const) : ('SCOPED' as const),
        },
      ]),
    ),
  };
  return new AccessContext(userId, [assignment]);
}

const MEMBER = access(
  'u1',
  [
    { code: PERMISSIONS.CHANGE_REQUEST_VIEW, mode: 'DIRECT' },
    { code: PERMISSIONS.CHANGE_REQUEST_CREATE, mode: 'DIRECT', all: true },
    { code: PERMISSIONS.SYLLABUS_EDIT, mode: 'VIA_REQUEST' },
  ],
  ['g1'],
);
const R2 = access('u2', [
  { code: PERMISSIONS.CHANGE_REQUEST_VIEW, mode: 'DIRECT' },
  { code: PERMISSIONS.CHANGE_REQUEST_CREATE_ORGANIZATIONAL, mode: 'DIRECT' },
]);

const DTO = {
  requestType: ChangeRequestType.SYLLABUS_CONTENT,
  targetType: ChangeTargetType.COURSE,
  targetId: 'c1',
  title: 'Tiêu đề',
  reason: 'Lý do',
  origin: RequestOrigin.FACULTY,
} satisfies CreateChangeRequestDto;

const OWN_DRAFT = {
  id: 'cr1',
  requestType: ChangeRequestType.SYLLABUS_CONTENT,
  targetType: ChangeTargetType.COURSE,
  courseId: 'c1',
  programId: null,
  subjectGroupId: null,
  createdById: 'u1',
  status: ChangeRequestStatus.DRAFT,
  submissionRound: 0,
  origin: RequestOrigin.FACULTY,
  basisDocumentNumber: null,
};

describe('ChangeRequestsService', () => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ value: 7n }]),
    roleAssignment: { findFirst: vi.fn().mockResolvedValue(null) },
    changeRequest: {
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    changeRequestDocument: { findMany: vi.fn(), deleteMany: vi.fn() },
  };
  const prisma = {
    approvalDelegation: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn((run: (client: unknown) => unknown) => run(tx)),
    changeRequest: { findFirst: vi.fn(), updateMany: vi.fn() },
    curriculumItem: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const targets = { resolve: vi.fn() };
  const copies = { create: vi.fn(), discard: vi.fn(), rebase: vi.fn() };
  const files = { remove: vi.fn().mockResolvedValue(undefined) };
  const details = { read: vi.fn().mockResolvedValue({ id: 'cr1' }) };
  let service: ChangeRequestsService;

  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ value: 7n }]);
    tx.roleAssignment.findFirst.mockResolvedValue(null);
    tx.changeRequest.create.mockResolvedValue({
      id: 'cr1',
      requestType: DTO.requestType,
      targetType: DTO.targetType,
      programId: null,
      courseId: 'c1',
    });
    tx.changeRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.changeRequestDocument.findMany.mockResolvedValue([]);
    prisma.changeRequest.findFirst.mockResolvedValue(OWN_DRAFT);
    prisma.changeRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.curriculumItem.findMany.mockResolvedValue([]);
    targets.resolve.mockResolvedValue({
      targetType: ChangeTargetType.COURSE,
      id: 'c1',
      code: 'IT1',
      name: 'Course',
      scope: { subjectGroupIds: ['g1'], orgUnitIds: ['f1'] },
    });
    service = new ChangeRequestsService(
      prisma as unknown as PrismaService,
      targets as unknown as RequestTargetResolver,
      copies as unknown as WorkingCopyService,
      {} as ConflictFinder,
      files as unknown as FileStorageService,
      details as unknown as ChangeRequestDetailReader,
    );
  });

  describe('create', () => {
    it('refuses a target kind the type does not take', async () => {
      await expect(
        service.create(
          { ...DTO, targetType: ChangeTargetType.PROGRAM },
          MEMBER,
        ),
      ).rejects.toMatchObject({ code: 'TYPE_TARGET_MISMATCH' });
      expect(targets.resolve).not.toHaveBeenCalled();
    });

    it('refuses a data type to a holder of the organisational permission only, before looking the target up', async () => {
      await expect(service.create(DTO, R2)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
      expect(targets.resolve).not.toHaveBeenCalled();
    });

    it('answers OUT_OF_SCOPE for a course of another group', async () => {
      targets.resolve.mockResolvedValue({
        targetType: ChangeTargetType.COURSE,
        id: 'c2',
        code: 'IT2',
        name: 'Other',
        scope: { subjectGroupIds: ['g2'], orgUnitIds: ['f1'] },
      });
      await expect(service.create(DTO, MEMBER)).rejects.toMatchObject({
        code: 'OUT_OF_SCOPE',
      });
      expect(tx.changeRequest.create).not.toHaveBeenCalled();
    });

    it('makes the request with a sequence code, the target key and the creator credential, then its copy', async () => {
      tx.roleAssignment.findFirst.mockResolvedValue({ id: 'ra' });
      await service.create(DTO, MEMBER);
      const data = tx.changeRequest.create.mock.calls[0][0].data;
      expect(data.requestCode).toMatch(/^DX-\d{4}-0007$/);
      expect(data).toMatchObject({
        courseId: 'c1',
        programId: null,
        subjectGroupId: null,
        targetCode: 'IT1',
        createdById: 'u1',
        createdByAcademicOffice: true,
        basisDocumentNumber: null,
      });
      expect(copies.create).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ id: 'cr1' }),
      );
      expect(details.read).toHaveBeenCalledWith('cr1', MEMBER);
    });

    describe('on a programme', () => {
      const lecturer = access(
        'u4',
        [
          {
            code: PERMISSIONS.CHANGE_REQUEST_CREATE,
            mode: 'DIRECT',
            all: true,
          },
          { code: PERMISSIONS.CURRICULUM_EDIT, mode: 'VIA_REQUEST' },
        ],
        ['g1'],
      );
      const programDto = {
        ...DTO,
        requestType: ChangeRequestType.CURRICULUM,
        targetType: ChangeTargetType.PROGRAM,
        targetId: 'p1',
      };

      beforeEach(() => {
        targets.resolve.mockResolvedValue({
          targetType: ChangeTargetType.PROGRAM,
          id: 'p1',
          code: 'P1',
          name: 'Program',
          scope: { programIds: ['p1'], orgUnitIds: ['f1'] },
        });
      });

      it('lets a lecturer file a curriculum request when a listed course is in their group', async () => {
        prisma.curriculumItem.findMany.mockResolvedValue([
          { course: { ownerGroupId: 'g1' } },
        ]);
        await service.create(programDto, lecturer);
        expect(tx.changeRequest.create).toHaveBeenCalledOnce();
      });

      it('refuses a lecturer when no listed course is in their group', async () => {
        prisma.curriculumItem.findMany.mockResolvedValue([
          { course: { ownerGroupId: 'g2' } },
        ]);
        await expect(
          service.create(programDto, lecturer),
        ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
      });

      it('lets a CLO editor file a programme outcome request', async () => {
        const cloEditor = access(
          'u5',
          [
            {
              code: PERMISSIONS.CHANGE_REQUEST_CREATE,
              mode: 'DIRECT',
              all: true,
            },
            { code: PERMISSIONS.CLO_EDIT, mode: 'VIA_REQUEST' },
          ],
          ['g1'],
        );
        prisma.curriculumItem.findMany.mockResolvedValue([
          { course: { ownerGroupId: 'g1' } },
        ]);
        await service.create(
          { ...programDto, requestType: ChangeRequestType.OUTCOME },
          cloEditor,
        );
        expect(tx.changeRequest.create).toHaveBeenCalledOnce();
      });

      it('does not widen a programme-info request to the lecturer groups', async () => {
        const infoEditor = access(
          'u6',
          [
            {
              code: PERMISSIONS.CHANGE_REQUEST_CREATE,
              mode: 'DIRECT',
              all: true,
            },
            { code: PERMISSIONS.PROGRAM_EDIT_INFO, mode: 'VIA_REQUEST' },
          ],
          ['g1'],
        );
        prisma.curriculumItem.findMany.mockResolvedValue([
          { course: { ownerGroupId: 'g1' } },
        ]);
        await expect(
          service.create(
            { ...programDto, requestType: ChangeRequestType.PROGRAM_INFO },
            infoEditor,
          ),
        ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
      });
    });

    it('lets an organisational permission holder file an organisational request inside the scope', async () => {
      const coordinator = access(
        'u3',
        [
          {
            code: PERMISSIONS.CHANGE_REQUEST_CREATE_ORGANIZATIONAL,
            mode: 'DIRECT',
          },
        ],
        ['g1'],
      );
      targets.resolve.mockResolvedValue({
        targetType: ChangeTargetType.SUBJECT_GROUP,
        id: 'g1',
        code: 'G1',
        name: 'G1',
        scope: { subjectGroupIds: ['g1'], orgUnitIds: ['f1'] },
      });
      await service.create(
        {
          ...DTO,
          requestType: ChangeRequestType.ORGANIZATION,
          targetType: ChangeTargetType.SUBJECT_GROUP,
          targetId: 'g1',
        },
        coordinator,
      );
      expect(tx.changeRequest.create).toHaveBeenCalledOnce();
      targets.resolve.mockResolvedValue({
        targetType: ChangeTargetType.SUBJECT_GROUP,
        id: 'g2',
        code: 'G2',
        name: 'G2',
        scope: { subjectGroupIds: ['g2'], orgUnitIds: ['f1'] },
      });
      await expect(
        service.create(
          {
            ...DTO,
            requestType: ChangeRequestType.ORGANIZATION,
            targetType: ChangeTargetType.SUBJECT_GROUP,
            targetId: 'g2',
          },
          coordinator,
        ),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });
  });

  describe('findOwnDraft', () => {
    it('answers 404 for a request the caller cannot see, 403 for another creator, 409 once submitted', async () => {
      prisma.changeRequest.findFirst.mockResolvedValue(null);
      await expect(service.findOwnDraft('cr1', MEMBER)).rejects.toMatchObject({
        code: 'REQUEST_NOT_FOUND',
      });
      prisma.changeRequest.findFirst.mockResolvedValue({
        ...OWN_DRAFT,
        createdById: 'someone',
      });
      await expect(service.findOwnDraft('cr1', MEMBER)).rejects.toMatchObject({
        code: 'REQUEST_NOT_CREATOR',
      });
      prisma.changeRequest.findFirst.mockResolvedValue({
        ...OWN_DRAFT,
        status: ChangeRequestStatus.PENDING_COORDINATOR,
      });
      await expect(service.findOwnDraft('cr1', MEMBER)).rejects.toMatchObject({
        code: 'REQUEST_NOT_DRAFT',
      });
    });
  });

  describe('update', () => {
    it('re-checks the basis rule on the merged row', async () => {
      await expect(
        service.update('cr1', { origin: RequestOrigin.UNIVERSITY }, MEMBER),
      ).rejects.toMatchObject({ code: 'BASIS_REQUIRED' });
      await service.update(
        'cr1',
        { origin: RequestOrigin.UNIVERSITY, basisDocumentNumber: '12/QĐ' },
        MEMBER,
      );
      expect(prisma.changeRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'cr1', status: ChangeRequestStatus.DRAFT },
        data: expect.objectContaining({
          origin: RequestOrigin.UNIVERSITY,
          basisDocumentNumber: '12/QĐ',
        }),
      });
    });

    it('loses cleanly to a submit that raced it', async () => {
      prisma.changeRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.update('cr1', { title: 'Mới' }, MEMBER),
      ).rejects.toMatchObject({ code: 'REQUEST_NOT_DRAFT' });
    });
  });

  describe('remove', () => {
    it('refuses a draft that was submitted before', async () => {
      prisma.changeRequest.findFirst.mockResolvedValue({
        ...OWN_DRAFT,
        submissionRound: 1,
      });
      await expect(service.remove('cr1', MEMBER)).rejects.toMatchObject({
        code: 'REQUEST_NOT_DELETABLE',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deletes the copy, the document rows and the request, and the files only after the commit', async () => {
      const order: string[] = [];
      copies.discard.mockImplementation(() => order.push('copy'));
      tx.changeRequestDocument.findMany.mockResolvedValue([
        { filePath: 'change-requests/cr1/a.pdf' },
      ]);
      tx.changeRequestDocument.deleteMany.mockImplementation(() =>
        order.push('documents'),
      );
      tx.changeRequest.delete.mockImplementation(() => order.push('request'));
      prisma.$transaction.mockImplementationOnce(
        async (run: (client: unknown) => unknown) => {
          const result = await run(tx);
          order.push('commit');
          return result;
        },
      );
      files.remove.mockImplementation(() => order.push('file'));
      await service.remove('cr1', MEMBER);
      expect(order).toEqual(['copy', 'documents', 'request', 'commit', 'file']);
      expect(files.remove).toHaveBeenCalledWith('change-requests/cr1/a.pdf');
    });

    it('stops when a submit changed the row between the read and the delete', async () => {
      tx.changeRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.remove('cr1', MEMBER)).rejects.toMatchObject({
        code: 'REQUEST_NOT_DELETABLE',
      });
      expect(tx.changeRequest.delete).not.toHaveBeenCalled();
    });
  });

  describe('rebase', () => {
    it('refuses types without a working copy and rebases the others', async () => {
      prisma.changeRequest.findFirst.mockResolvedValue({
        ...OWN_DRAFT,
        requestType: ChangeRequestType.COURSE_RELATION,
      });
      await expect(service.rebase('cr1', MEMBER)).rejects.toMatchObject({
        code: 'NOT_WORKSPACE_TYPE',
      });
      prisma.changeRequest.findFirst.mockResolvedValue(OWN_DRAFT);
      await service.rebase('cr1', MEMBER);
      expect(copies.rebase).toHaveBeenCalledWith(tx, OWN_DRAFT);
    });
  });
});
