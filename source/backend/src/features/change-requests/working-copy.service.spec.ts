import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChangeRequestType,
  ChangeTargetType,
  Prisma,
  ProgramVersionStatus,
} from '../../generated/prisma/client.js';
import type { VersionContentCopier } from '../../shared/programs/version-content.copier.js';
import { WorkingCopyService, type CopyOwner } from './working-copy.service.js';

vi.mock('../../shared/syllabi/syllabus-revision.copier.js', () => ({
  copySyllabusRevision: vi.fn().mockResolvedValue('syllabus-copy'),
}));
const { copySyllabusRevision } =
  await import('../../shared/syllabi/syllabus-revision.copier.js');

const BASE = {
  id: 'v-base',
  programName: 'Kỹ thuật máy tính',
  majorCode: '7480106',
  majorName: 'KTMT',
  semesterCount: 10,
  totalCredits: new Prisma.Decimal('150'),
  compulsoryCredits: new Prisma.Decimal('140'),
  electiveCredits: new Prisma.Decimal('10'),
  creditMismatchReason: null,
  creditMismatchCompulsoryGap: null,
  creditMismatchElectiveGap: null,
  creditMismatchAcceptedById: null,
  creditMismatchAcceptedAt: null,
};

const owner = (patch: Partial<CopyOwner>): CopyOwner => ({
  id: 'cr1',
  requestType: ChangeRequestType.CURRICULUM,
  targetType: ChangeTargetType.PROGRAM,
  programId: 'p1',
  courseId: null,
  ...patch,
});

describe('WorkingCopyService', () => {
  const copier = { copy: vi.fn().mockResolvedValue(undefined) };
  const programVersion = {
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const syllabus = {
    findFirst: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const tx = {
    programVersion,
    syllabus,
  } as unknown as Prisma.TransactionClient;
  let service: WorkingCopyService;

  beforeEach(() => {
    vi.clearAllMocks();
    programVersion.findFirst.mockResolvedValue(BASE);
    programVersion.create.mockResolvedValue({ id: 'v-copy' });
    syllabus.findFirst.mockResolvedValue({ id: 's-base' });
    service = new WorkingCopyService(copier as unknown as VersionContentCopier);
  });

  it('copies the newest released, non-copy version into an unnumbered Draft and copies its content', async () => {
    await service.create(tx, owner({}));
    expect(programVersion.findFirst.mock.calls[0][0].where).toEqual({
      programId: 'p1',
      sourceRequestId: null,
      status: { not: ProgramVersionStatus.DRAFT },
    });
    const data = programVersion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      programId: 'p1',
      status: ProgramVersionStatus.DRAFT,
      sourceRequestId: 'cr1',
      baseVersionId: 'v-base',
      programName: 'Kỹ thuật máy tính',
    });
    expect(data).not.toHaveProperty('versionNumber');
    expect(copier.copy).toHaveBeenCalledWith(tx, 'v-base', 'v-copy');
  });

  it('refuses a program that only has its own Draft', async () => {
    programVersion.findFirst.mockResolvedValue(null);
    await expect(service.create(tx, owner({}))).rejects.toMatchObject({
      code: 'TARGET_NOT_RELEASED',
    });
    expect(programVersion.create).not.toHaveBeenCalled();
  });

  it('copies the published revision for a syllabus request and refuses a course without one', async () => {
    const request = owner({
      requestType: ChangeRequestType.SYLLABUS_CONTENT,
      targetType: ChangeTargetType.COURSE,
      programId: null,
      courseId: 'c1',
    });
    await service.create(tx, request);
    expect(copySyllabusRevision).toHaveBeenCalledWith(tx, 's-base', {
      sourceRequestId: 'cr1',
    });
    syllabus.findFirst.mockResolvedValue(null);
    await expect(service.create(tx, request)).rejects.toMatchObject({
      code: 'TARGET_NOT_RELEASED',
    });
  });

  it('copies the published revision for a grading-formula request', async () => {
    await service.create(
      tx,
      owner({
        requestType: ChangeRequestType.GRADING_FORMULA,
        targetType: ChangeTargetType.COURSE,
        programId: null,
        courseId: 'c1',
      }),
    );
    expect(copySyllabusRevision).toHaveBeenCalledWith(tx, 's-base', {
      sourceRequestId: 'cr1',
    });
  });

  it('makes a program copy for an outcome request on a program and a syllabus copy on a course', async () => {
    await service.create(tx, owner({ requestType: ChangeRequestType.OUTCOME }));
    expect(programVersion.create).toHaveBeenCalledOnce();
    await service.create(
      tx,
      owner({
        requestType: ChangeRequestType.OUTCOME,
        targetType: ChangeTargetType.COURSE,
        programId: null,
        courseId: 'c1',
      }),
    );
    expect(copySyllabusRevision).toHaveBeenCalledOnce();
  });

  it('copies nothing for authored types', async () => {
    await service.create(
      tx,
      owner({
        requestType: ChangeRequestType.COURSE_RELATION,
        targetType: ChangeTargetType.COURSE,
        programId: null,
        courseId: 'c1',
      }),
    );
    expect(programVersion.create).not.toHaveBeenCalled();
    expect(copySyllabusRevision).not.toHaveBeenCalled();
  });

  it('discards both kinds of copy of the request and rebases by discarding then copying again', async () => {
    await service.discard(tx, 'cr1');
    expect(programVersion.deleteMany).toHaveBeenCalledWith({
      where: { sourceRequestId: 'cr1' },
    });
    expect(syllabus.deleteMany).toHaveBeenCalledWith({
      where: { sourceRequestId: 'cr1' },
    });
    await service.rebase(tx, owner({}));
    expect(programVersion.deleteMany).toHaveBeenCalledTimes(2);
    expect(programVersion.create).toHaveBeenCalledOnce();
  });
});
