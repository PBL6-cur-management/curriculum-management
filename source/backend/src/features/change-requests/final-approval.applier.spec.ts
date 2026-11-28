import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChangeRequestType,
  type ChangeRequest,
  type Prisma,
} from '../../generated/prisma/client.js';
import { applyApprovedCourseField } from '../../shared/courses/course.writer.js';
import {
  createRelation,
  removeRelation,
  updateRelationMinScore,
} from '../../shared/courses/course-relation.writer.js';
import type { ConsistencyChecker } from '../../shared/curriculum/consistency-checker.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COURSE_WRITE_ERRORS } from '../../shared/courses/course-write.errors.js';
import type { VersionContentCopier } from '../../shared/programs/version-content.copier.js';
import type { SyllabusPublisher } from '../../shared/releases/syllabus.publisher.js';
import type { VersionPublisher } from '../../shared/releases/version.publisher.js';
import { FinalApprovalApplier } from './final-approval.applier.js';

vi.mock('../../shared/courses/course.writer.js', () => ({
  applyApprovedCourseField: vi.fn(),
}));
vi.mock('../../shared/courses/course-relation.writer.js', () => ({
  createRelation: vi.fn(),
  updateRelationMinScore: vi.fn(),
  removeRelation: vi.fn(),
}));
vi.mock(
  '../../shared/releases/version.publisher.js',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    repointCourseLinks: vi.fn().mockResolvedValue(0),
  }),
);

const base = {
  id: 'base',
  programId: 'p1',
  versionNumber: '1.2',
  effectiveSemesterId: 'sem0',
  programName: 'CT',
  majorCode: 'M',
  majorName: 'N',
  semesterCount: 8,
  totalCredits: 1,
  compulsoryCredits: 1,
  electiveCredits: 0,
};
const semester = {
  id: 'sem',
  semesterCode: 'S',
  academicYear: 'Y',
  termInYear: 1,
  startDate: new Date('2026-09-07T00:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
};
const NOW = new Date('2026-10-19T03:00:00.000Z');
const context = {
  dto: {
    decisionNumber: 'QD',
    signedDate: '2026-10-01',
    effectiveSemesterId: 'sem',
  },
  semester,
  actorId: 'office',
  now: NOW,
  today: new Date('2026-10-19T00:00:00.000Z'),
};

function requestOf(patch: Partial<ChangeRequest>): ChangeRequest {
  return {
    id: 'r1',
    requestType: ChangeRequestType.CURRICULUM,
    targetType: 'PROGRAM',
    programId: 'p1',
    courseId: null,
    ...patch,
  } as ChangeRequest;
}

describe('FinalApprovalApplier', () => {
  let tx: Record<string, unknown>;
  let db: {
    cohort: { count: ReturnType<typeof vi.fn> };
    programVersion: Record<string, ReturnType<typeof vi.fn>>;
    syllabus: Record<string, ReturnType<typeof vi.fn>>;
    semester: { findUnique: ReturnType<typeof vi.fn> };
    changeItem: { findMany: ReturnType<typeof vi.fn> };
    curriculumItem: { updateMany: ReturnType<typeof vi.fn> };
  };
  let consistency: { assertPasses: ReturnType<typeof vi.fn> };
  let publisher: { promote: ReturnType<typeof vi.fn> };
  let syllabi: { publishFromRequest: ReturnType<typeof vi.fn> };
  let copier: { copy: ReturnType<typeof vi.fn> };
  let applier: FinalApprovalApplier;
  const run = (request: ChangeRequest, extra: object = {}) =>
    applier.apply(tx as unknown as Prisma.TransactionClient, request, {
      ...context,
      ...extra,
    } as never);

  beforeEach(() => {
    vi.clearAllMocks();
    db = {
      cohort: { count: vi.fn().mockResolvedValue(0) },
      programVersion: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ id: 'copy', programId: 'p1' }),
        findFirst: vi.fn().mockResolvedValue(base),
        findMany: vi
          .fn()
          .mockResolvedValue([
            { versionNumber: '1.0' },
            { versionNumber: '1.2' },
          ]),
        create: vi.fn().mockResolvedValue({ id: 'shell' }),
      },
      syllabus: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'scopy' }),
      },
      semester: {
        findUnique: vi.fn().mockResolvedValue({
          startDate: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
      changeItem: { findMany: vi.fn().mockResolvedValue([]) },
      curriculumItem: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      } as never,
    };
    tx = { ...db, $queryRaw: vi.fn().mockResolvedValue([]) };
    consistency = { assertPasses: vi.fn().mockResolvedValue(undefined) };
    publisher = {
      promote: vi.fn((_tx: unknown, input: { versionNumber: string }) =>
        Promise.resolve({ id: 'released', status: 'ACTIVE', ...input }),
      ),
    };
    syllabi = {
      publishFromRequest: vi
        .fn()
        .mockResolvedValue({ revision: { id: 'rev2' } }),
    };
    copier = { copy: vi.fn().mockResolvedValue(undefined) };
    applier = new FinalApprovalApplier(
      consistency as unknown as ConsistencyChecker,
      publisher as unknown as VersionPublisher,
      syllabi as unknown as SyllabusPublisher,
      copier as unknown as VersionContentCopier,
    );
  });

  describe('a program request', () => {
    it('promotes the working copy as the next major for a curriculum change, on the newest released version', async () => {
      const released = await run(requestOf({}));

      expect(consistency.assertPasses).toHaveBeenCalledWith('copy', tx);
      expect(publisher.promote).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          versionId: 'copy',
          programId: 'p1',
          versionNumber: '2.0',
          previousVersionId: 'base',
          originRequestId: 'r1',
          decisionNumber: 'QD',
          publisherId: 'office',
          cohortIds: [],
        }),
      );
      expect(released).toHaveLength(1);
    });

    it('takes a minor number for program info', async () => {
      await run(requestOf({ requestType: ChangeRequestType.PROGRAM_INFO }));

      expect(publisher.promote.mock.calls[0][1].versionNumber).toBe('1.3');
    });

    it('stops on a consistency error and promotes nothing', async () => {
      consistency.assertPasses.mockRejectedValue(
        new Error('CONSISTENCY_FAILED'),
      );

      await expect(run(requestOf({}))).rejects.toThrow('CONSISTENCY_FAILED');
      expect(publisher.promote).not.toHaveBeenCalled();
    });

    it('refuses a semester earlier than the version it builds on', async () => {
      db.semester.findUnique.mockResolvedValue({
        startDate: new Date('2027-01-01T00:00:00.000Z'),
      });

      await expect(run(requestOf({}))).rejects.toMatchObject({
        code: 'EFFECTIVE_BEFORE_BASE',
      });
      expect(publisher.promote).not.toHaveBeenCalled();
    });

    it('refuses an unknown cohort before anything is written', async () => {
      db.cohort.count.mockResolvedValue(0);

      await expect(
        run(requestOf({}), {
          dto: { ...context.dto, cohortIds: ['gone'] },
        }),
      ).rejects.toMatchObject({ code: 'COHORT_NOT_FOUND' });
      expect(publisher.promote).not.toHaveBeenCalled();
    });
  });

  describe('a syllabus request', () => {
    const syllabusRequest = requestOf({
      requestType: ChangeRequestType.SYLLABUS_CONTENT,
      targetType: 'COURSE',
      programId: null,
      courseId: 'c1',
    });
    const target = (programId: string) => ({
      ...base,
      id: `base-${programId}`,
      programId,
      versionNumber: '1.0',
      createdAt: new Date(),
      program: { programCode: programId },
      effectiveSemester: { startDate: new Date('2026-01-01T00:00:00.000Z') },
      status: 'ACTIVE',
    });

    it('makes a minor version for every program that holds the course, pinned to the new revision', async () => {
      db.programVersion.findMany.mockImplementation(
        (args: { where: { sourceRequestId?: null } }) =>
          Promise.resolve(
            args.where.sourceRequestId === null
              ? [target('pa'), target('pb'), target('pc')]
              : [{ versionNumber: '1.0' }],
          ),
      );

      const released = await run(syllabusRequest);

      expect(syllabi.publishFromRequest).toHaveBeenCalledWith(
        tx,
        'scopy',
        'r1',
        NOW,
        expect.objectContaining({
          effectiveSemesterId: 'sem',
          documentNumber: 'QD',
        }),
      );
      expect(released).toHaveLength(3);
      expect(copier.copy).toHaveBeenCalledTimes(3);
      expect(db.curriculumItem.updateMany).toHaveBeenCalledTimes(3);
      expect(db.curriculumItem.updateMany).toHaveBeenCalledWith({
        where: { versionId: 'shell', courseId: 'c1' },
        data: { syllabusId: 'rev2' },
      });
      expect(
        publisher.promote.mock.calls.map((call) => call[1].versionNumber),
      ).toEqual(['1.1', '1.1', '1.1']);
    });

    it('publishes the revision and creates no version when no program holds the course', async () => {
      db.programVersion.findMany.mockResolvedValue([]);

      expect(await run(syllabusRequest)).toEqual([]);
      expect(syllabi.publishFromRequest).toHaveBeenCalledTimes(1);
      expect(publisher.promote).not.toHaveBeenCalled();
    });

    it('applies cohorts to each affected program version when fanning out across multiple programs', async () => {
      const withCohort = { dto: { ...context.dto, cohortIds: ['k1'] } };
      db.cohort.count.mockResolvedValue(1);
      db.programVersion.findMany.mockImplementation(
        (args: { where: { sourceRequestId?: null } }) =>
          Promise.resolve(
            args.where.sourceRequestId === null
              ? [target('pa'), target('pb')]
              : [{ versionNumber: '1.0' }],
          ),
      );
      const released = await run(syllabusRequest, withCohort);
      expect(released).toHaveLength(2);
      expect(publisher.promote).toHaveBeenCalledTimes(2);
      expect(publisher.promote.mock.calls[0][1].cohortIds).toEqual(['k1']);
      expect(publisher.promote.mock.calls[1][1].cohortIds).toEqual(['k1']);
    });

    it('rolls everything back when the third program fails its consistency check', async () => {
      db.programVersion.findMany.mockImplementation(
        (args: { where: { sourceRequestId?: null } }) =>
          Promise.resolve(
            args.where.sourceRequestId === null
              ? [target('pa'), target('pb'), target('pc')]
              : [],
          ),
      );
      consistency.assertPasses
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('CONSISTENCY_FAILED'));

      await expect(run(syllabusRequest)).rejects.toThrow('CONSISTENCY_FAILED');
      // The exception unwinds the caller's transaction: two promotions happened inside it and none survive.
      expect(publisher.promote).toHaveBeenCalledTimes(2);
    });
  });

  describe('a course request', () => {
    const courseRequest = requestOf({
      requestType: ChangeRequestType.COURSE_RELATION,
      targetType: 'COURSE',
      programId: null,
      courseId: 'c1',
    });
    const item = (label: string, newValue: object) => ({
      label,
      newValue: { ...newValue },
    });

    it('applies each authored item through the writer that owns its rule, in authored order, and makes no version', async () => {
      db.changeItem.findMany.mockResolvedValue([
        item('Tín chỉ', {
          operation: 'SET_COURSE_FIELD',
          field: 'credits',
          value: '4',
        }),
        item('Thêm', {
          operation: 'ADD_RELATION',
          sourceCourseId: 'a',
          targetCourseId: 'b',
          relationType: 'PREREQUISITE',
          minScore: null,
        }),
        item('Ngưỡng', {
          operation: 'UPDATE_RELATION',
          relationId: 'rel1',
          minScore: '2',
        }),
        item('Gỡ', { operation: 'REMOVE_RELATION', relationId: 'rel2' }),
      ]);

      expect(await run(courseRequest)).toEqual([]);

      expect(applyApprovedCourseField).toHaveBeenCalledWith(
        tx,
        'c1',
        'credits',
        '4',
      );
      expect(createRelation).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sourceCourseId: 'a', targetCourseId: 'b' }),
      );
      expect(updateRelationMinScore).toHaveBeenCalledWith(tx, 'rel1', '2');
      expect(removeRelation).toHaveBeenCalledWith(tx, 'rel2');
      expect(publisher.promote).not.toHaveBeenCalled();
    });

    it('names the item a writer refused and applies nothing after it', async () => {
      db.changeItem.findMany.mockResolvedValue([
        item('Tên học phần', {
          operation: 'SET_COURSE_FIELD',
          field: 'courseName',
          value: 'X',
        }),
        item('Vòng tiên quyết', {
          operation: 'ADD_RELATION',
          sourceCourseId: 'a',
          targetCourseId: 'b',
          relationType: 'PREREQUISITE',
          minScore: null,
        }),
        item('Gỡ', { operation: 'REMOVE_RELATION', relationId: 'rel2' }),
      ]);
      vi.mocked(createRelation).mockRejectedValue(
        new AppException(COURSE_WRITE_ERRORS.COURSE_CANCELLED),
      );

      await expect(run(courseRequest)).rejects.toMatchObject({
        code: 'ITEM_APPLY_FAILED',
        details: [
          { field: 'Vòng tiên quyết', constraints: ['COURSE_CANCELLED'] },
        ],
      });
      expect(removeRelation).not.toHaveBeenCalled();
    });

    it('refuses an operation a course request may not carry', async () => {
      db.changeItem.findMany.mockResolvedValue([
        item('Thêm thành viên', { operation: 'ADD_MEMBER' }),
      ]);

      await expect(run(courseRequest)).rejects.toMatchObject({
        code: 'ITEM_APPLY_FAILED',
      });
    });

    it('takes no cohorts', async () => {
      db.cohort.count.mockResolvedValue(1);

      await expect(
        run(courseRequest, { dto: { ...context.dto, cohortIds: ['k1'] } }),
      ).rejects.toMatchObject({ code: 'COHORTS_NOT_ALLOWED' });
    });
  });
});
