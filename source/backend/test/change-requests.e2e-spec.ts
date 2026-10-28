import { existsSync, readdirSync } from 'node:fs';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { seedApprovalLevels } from '../prisma/seed-data/approval-levels.js';
import {
  ChangeRequestStatus,
  ProgramVersionStatus,
  SubjectGroupMemberRole,
} from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { todayDate, toIsoDay } from '../src/shared/time/today.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  approveAs,
  openRequest,
  postRequest,
  publishedCourse,
  readRequest,
  releaseAnotherVersion,
  releasedProgram,
  returnAs,
  type RequestStep,
  submitRequest,
} from './fixtures/change-requests.js';
import { createForeignFaculty } from './fixtures/courses.js';
import { readCurriculum } from './fixtures/curriculum.js';
import { assignDirector, createProgram } from './fixtures/programs.js';
import {
  addMembership,
  createSubjectGroup,
} from './fixtures/subject-groups.js';
import { PDF_BYTES } from './fixtures/syllabi.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

type Agent = ReturnType<typeof request.agent>;

describe('change requests: authoring, routing and withdrawal', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let admin2Id: string;
  let viewer: Agent;
  let outsider: Agent;
  let memberA: Agent;
  let memberA2: Agent;
  let coordA: Agent;
  let coordAId: string;
  let coordB1Id: string;
  let coordB2Id: string;
  let directorA: Agent;
  let directorAId: string;
  let ga: string;
  let gb: string;
  let counter = 0;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    await seedApprovalLevels(prisma);
    ga = (await createSubjectGroup(app, 'CR_GA')).id;
    gb = (await createSubjectGroup(app, 'CR_GB')).id;
    admin = await loginAgent(app, await createAccount(app, 'cradmin', 'R1'));
    admin2Id = (await createAccount(app, 'cradmin2', 'R1')).id;
    // R2 needs a unit scope to be refused anything; an unscoped one would see every unit.
    viewer = await loginAgent(
      app,
      await createAccount(app, 'crviewer', 'R2', { unitCode: 'KHOA_CNTT' }),
    );
    outsider = await loginAgent(app, await createAccount(app, 'croutsider'));
    const memberAAccount = await createAccount(app, 'crmembera');
    await addMembership(app, { groupId: ga, userId: memberAAccount.id });
    memberA = await loginAgent(app, memberAAccount);
    const memberA2Account = await createAccount(app, 'crmembera2');
    await addMembership(app, { groupId: ga, userId: memberA2Account.id });
    memberA2 = await loginAgent(app, memberA2Account);
    const coordAAccount = await createAccount(app, 'crcoorda');
    await coordinate(ga, coordAAccount.id);
    coordAId = coordAAccount.id;
    coordA = await loginAgent(app, coordAAccount);
    coordB1Id = (await createAccount(app, 'crcoordb1')).id;
    coordB2Id = (await createAccount(app, 'crcoordb2')).id;
    await coordinate(gb, coordB1Id);
    await coordinate(gb, coordB2Id);
    const directorAAccount = await createAccount(app, 'crdira');
    directorAId = directorAAccount.id;
    directorA = await loginAgent(app, directorAAccount);
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  // A coordinator is also a member; both rows exist, as the members screen writes them.
  async function coordinate(groupId: string, userId: string) {
    for (const memberRole of [
      SubjectGroupMemberRole.MEMBER,
      SubjectGroupMemberRole.COORDINATOR,
    ]) {
      await addMembership(app, { groupId, userId, memberRole });
    }
  }

  const code = (prefix: string) => `${prefix}${(counter += 1)}`;

  const syllabusBody = (courseId: string) => ({
    requestType: 'SYLLABUS_CONTENT',
    targetType: 'COURSE',
    targetId: courseId,
  });

  async function editCopy(
    agent: Agent,
    copyId: string,
    objectives = '<p>Mới</p>',
  ) {
    return agent
      .patch(`/api/syllabi/${copyId}`)
      .set(CSRF)
      .send({ objectives })
      .expect(200);
  }

  const rows = (steps: RequestStep[], level: number) =>
    steps.filter((step) => step.approvalLevel === level);

  describe('syllabus request on a working copy', () => {
    it('edits a copy, leaves the published revision alone and refuses everyone else (US-053, US-054)', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      const created = await openRequest(memberA, syllabusBody(course.id));
      expect(created.requestCode).toMatch(/^DX-\d{4}-\d{4}$/);
      expect(created.status).toBe('DRAFT');
      expect(created.workspace).toMatchObject({
        kind: 'SYLLABUS',
        isStale: false,
      });

      await editCopy(memberA, created.workspace!.copyId);
      const published = await memberA
        .get(`/api/courses/${course.id}/syllabus`)
        .expect(200);
      expect(published.body.published.objectives).toBe('<p>Mục tiêu gốc</p>');
      expect(published.body.draft).toBeNull();
      const withCopy = await memberA
        .get(`/api/courses/${course.id}/syllabus?requestId=${created.id}`)
        .expect(200);
      expect(withCopy.body.draft).toMatchObject({
        id: created.workspace!.copyId,
        objectives: '<p>Mới</p>',
        revisionNumber: null,
        sourceRequest: { requestCode: created.requestCode },
      });
      expect(withCopy.body.published.objectives).toBe('<p>Mục tiêu gốc</p>');

      const colleague = await memberA2
        .patch(`/api/syllabi/${created.workspace!.copyId}`)
        .set(CSRF)
        .send({ objectives: '<p>Của người khác</p>' })
        .expect(403);
      expect(colleague.body.code).toBe('REQUEST_NOT_CREATOR');

      const direct = await admin
        .patch(`/api/syllabi/${withCopy.body.published.id}`)
        .set(CSRF)
        .send({ objectives: '<p>Trực tiếp</p>' })
        .expect(409);
      expect(direct.body.code).toBe('CHANGE_REQUEST_REQUIRED');

      const diff = await memberA
        .get(`/api/change-requests/${created.id}/diff`)
        .expect(200);
      expect(diff.body.live).toBe(true);
      expect(diff.body.sections).toHaveLength(1);
      expect(diff.body.sections[0]).toMatchObject({
        entityType: 'SYLLABUS_FIELD',
      });
      expect(diff.body.sections[0].rows[0]).toMatchObject({
        itemKey: 'objectives',
        change: 'CHANGED',
      });
      expect(diff.body.sections[0].rows[0].fields[0]).toMatchObject({
        before: 'Mục tiêu gốc',
        after: 'Mới',
      });
    });

    it('refuses a copy for a course of another group and one that was never released (US-054 AC5, US-053 AC3)', async () => {
      const foreign = await publishedCourse(app, admin, code('CRS'), gb);
      const refused = await postRequest(
        memberA,
        syllabusBody(foreign.id),
      ).expect(403);
      expect(refused.body.code).toBe('OUT_OF_SCOPE');

      const unreleased = await createProgram(app, { programCode: code('CRP') });
      await assignDirector(app, {
        programId: unreleased.id,
        userId: directorAId,
      });
      const body = {
        requestType: 'CURRICULUM',
        targetType: 'PROGRAM',
        targetId: unreleased.id,
      };
      const neverReleased = await postRequest(directorA, body).expect(409);
      expect(neverReleased.body.code).toBe('TARGET_NOT_RELEASED');
      expect(
        await prisma.changeRequest.count({
          where: { programId: unreleased.id },
        }),
      ).toBe(0);
    });

    it('opens a grading-formula request on a syllabus copy, refuses a data type to R2 and the list to a user without a role (US-054 AC1, US-060 AC3)', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      const formula = await postRequest(memberA, {
        requestType: 'GRADING_FORMULA',
        targetType: 'COURSE',
        targetId: course.id,
      }).expect(201);
      const opened = await readRequest(memberA, formula.body.id);
      expect(opened.workspace?.kind).toBe('SYLLABUS');
      const r2 = await postRequest(viewer, syllabusBody(course.id)).expect(403);
      expect(r2.body.code).toBe('PERMISSION_DENIED');
      await outsider.get('/api/change-requests').expect(403);
    });
  });

  describe('curriculum request routing', () => {
    it('routes a program copy to every coordinator, the creator row skipped, then the office (KB-041)', async () => {
      const courseA = await publishedCourse(app, admin, code('CRA'), ga);
      const courseB = await publishedCourse(app, admin, code('CRB'), gb);
      const program = await releasedProgram(app, admin, code('CRP'), [
        courseA.id,
        courseB.id,
      ]);
      await assignDirector(app, {
        programId: program.programId,
        userId: directorAId,
      });

      const created = await openRequest(directorA, {
        requestType: 'CURRICULUM',
        targetType: 'PROGRAM',
        targetId: program.programId,
      });
      const copyId = created.workspace!.copyId;
      const copy = await readCurriculum(directorA, copyId);
      expect(copy.version.sourceRequest.requestCode).toBe(created.requestCode);
      expect(copy.items).toHaveLength(2);
      expect(copy.canEditStructure).toBe(true);
      for (const item of copy.items) {
        await directorA
          .patch(`/api/curriculum-items/${item.id}`)
          .set(CSRF)
          .send({ plannedSemester: 2 })
          .expect(200);
      }
      // The released version is untouched; the program's own list never shows the copy.
      const live = await readCurriculum(admin, program.versionId);
      expect(
        live.items.map(
          (item: { plannedSemester: number }) => item.plannedSemester,
        ),
      ).toEqual([1, 1]);
      const detail = await directorA
        .get(`/api/programs/${program.programId}`)
        .expect(200);
      expect(detail.body.versions).toHaveLength(1);
      expect(detail.body.draftVersion).toBeNull();

      const preview = await directorA
        .get(`/api/change-requests/${created.id}/submit-preview`)
        .expect(200);
      expect(preview.body.blockingIssues).toEqual([]);
      expect(preview.body.itemCount).toBe(2);
      expect(preview.body.affectedPrograms).toHaveLength(1);

      const submitted = (await submitRequest(directorA, created.id).expect(200))
        .body;
      expect(submitted.status).toBe('PENDING_COORDINATOR');
      expect(submitted.submissionRound).toBe(1);
      const level1 = rows(submitted.steps, 1);
      expect(level1.map((step) => step.approver!.id).sort()).toEqual(
        [coordAId, coordB1Id, coordB2Id].sort(),
      );
      expect(level1.every((step) => !step.isSkipped)).toBe(true);
      const level2 = rows(submitted.steps, 2);
      expect(level2).toHaveLength(1);
      expect(level2[0]).toMatchObject({ isSkipped: true, action: 'APPROVE' });
      expect(level2[0].skipReason).toBe('Người duyệt là người tạo đề xuất');
      expect(rows(submitted.steps, 3)).toEqual([
        expect.objectContaining({
          approver: null,
          action: 'PENDING',
          isSkipped: false,
        }),
      ]);
      expect(
        await prisma.changeItem.count({
          where: { changeRequestId: created.id },
        }),
      ).toBe(2);

      // Frozen after submit: the creator no longer writes the copy.
      const frozen = await directorA
        .patch(`/api/curriculum-items/${copy.items[0].id}`)
        .set(CSRF)
        .send({ plannedSemester: 3 })
        .expect(409);
      expect(frozen.body.code).toBe('REQUEST_NOT_DRAFT');
    });
  });

  describe('stale base, empty and inconsistent submissions', () => {
    it('refuses an empty submit, then a stale one, and rebases onto the new base (US-058 AC2)', async () => {
      const courseA = await publishedCourse(app, admin, code('CRA'), ga);
      const program = await releasedProgram(app, admin, code('CRP'), [
        courseA.id,
      ]);
      await assignDirector(app, {
        programId: program.programId,
        userId: directorAId,
      });
      const created = await openRequest(directorA, {
        requestType: 'CURRICULUM',
        targetType: 'PROGRAM',
        targetId: program.programId,
      });
      const empty = await submitRequest(directorA, created.id).expect(409);
      expect(empty.body.code).toBe('NO_CHANGES');
      expect(
        await prisma.changeRequest.findUniqueOrThrow({
          where: { id: created.id },
        }),
      ).toMatchObject({
        submissionRound: 0,
        status: ChangeRequestStatus.DRAFT,
      });

      const copy = await readCurriculum(directorA, created.workspace!.copyId);
      await directorA
        .patch(`/api/curriculum-items/${copy.items[0].id}`)
        .set(CSRF)
        .send({ plannedSemester: 2 })
        .expect(200);
      const newer = await releaseAnotherVersion(
        admin,
        program.programId,
        program.versionId,
      );
      const stale = await submitRequest(directorA, created.id).expect(409);
      expect(stale.body.code).toBe('STALE_BASE');
      const preview = await directorA
        .get(`/api/change-requests/${created.id}/submit-preview`)
        .expect(200);
      expect(
        preview.body.blockingIssues.map(
          (issue: { code: string }) => issue.code,
        ),
      ).toContain('STALE_BASE');
      expect(
        (await readRequest(directorA, created.id)).workspace!.isStale,
      ).toBe(true);

      const rebased = (
        await directorA
          .post(`/api/change-requests/${created.id}/rebase`)
          .set(CSRF)
          .expect(200)
      ).body;
      expect(rebased.workspace.isStale).toBe(false);
      const row = await prisma.programVersion.findFirstOrThrow({
        where: { sourceRequestId: created.id },
      });
      expect(row.baseVersionId).toBe(newer.id);
      expect(row.id).not.toBe(created.workspace!.copyId);
    });

    it('blocks a program copy whose framework still has errors (F-08)', async () => {
      const courseA = await publishedCourse(app, admin, code('CRA'), ga);
      const program = await releasedProgram(app, admin, code('CRP'), [
        courseA.id,
      ]);
      await assignDirector(app, {
        programId: program.programId,
        userId: directorAId,
      });
      const created = await openRequest(directorA, {
        requestType: 'CURRICULUM',
        targetType: 'PROGRAM',
        targetId: program.programId,
      });
      const copyId = created.workspace!.copyId;
      // A group asking for more credits than its courses can give is an ERROR.
      await directorA
        .post(`/api/program-versions/${copyId}/elective-groups`)
        .set(CSRF)
        .send({ groupCode: 'G1', groupName: 'Nhóm 1', minCredits: '99' })
        .expect(201);
      const refused = await submitRequest(directorA, created.id).expect(409);
      expect(refused.body.code).toBe('CONSISTENCY_FAILED');
      const preview = await directorA
        .get(`/api/change-requests/${created.id}/submit-preview`)
        .expect(200);
      expect(preview.body.blockingIssues[0].code).toBe('CONSISTENCY_FAILED');
    });
  });

  describe('course items and other faculties', () => {
    it('sends another faculty course straight to the academic office (KB-043)', async () => {
      await createForeignFaculty(app, 'KHOA_CR');
      const course = await publishedCourse(
        app,
        admin,
        code('CRF'),
        null,
        'KHOA_CR',
      );
      const created = await openRequest(directorA, {
        requestType: 'COURSE_RELATION',
        targetType: 'COURSE',
        targetId: course.id,
      });
      expect(created.workspace).toBeNull();
      const unchanged = await directorA
        .put(`/api/change-requests/${created.id}/items`)
        .set(CSRF)
        .send({
          items: [
            { operation: 'SET_COURSE_FIELD', field: 'credits', value: '3' },
          ],
        })
        .expect(400);
      expect(unchanged.body.code).toBe('ITEM_UNCHANGED');
      expect(unchanged.body.details[0].field).toBe('items.0');
      const saved = await directorA
        .put(`/api/change-requests/${created.id}/items`)
        .set(CSRF)
        .send({
          items: [
            { operation: 'SET_COURSE_FIELD', field: 'credits', value: '4' },
          ],
        })
        .expect(200);
      expect(saved.body.authoredItems).toHaveLength(1);
      const submitted = (await submitRequest(directorA, created.id).expect(200))
        .body;
      expect(submitted.status).toBe('PENDING_ACADEMIC_OFFICE');
      expect(rows(submitted.steps, 1)[0]).toMatchObject({
        isSkipped: true,
        skipReason: 'Không áp dụng — học phần của khoa khác',
      });
      expect(rows(submitted.steps, 2)[0].isSkipped).toBe(true);
      expect(rows(submitted.steps, 3)).toHaveLength(1);
      const diff = await directorA
        .get(`/api/change-requests/${created.id}/diff`)
        .expect(200);
      expect(diff.body.live).toBe(false);
      expect(diff.body.sections[0].rows[0].fields[0]).toMatchObject({
        before: '3',
        after: '4',
      });
    });

    it('refuses typed items on a workspace request and items of another type', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      const created = await openRequest(memberA, syllabusBody(course.id));
      const refused = await memberA
        .put(`/api/change-requests/${created.id}/items`)
        .set(CSRF)
        .send({ items: [] })
        .expect(409);
      expect(refused.body.code).toBe('ITEMS_NOT_AUTHORED');
      const relation = await publishedCourse(app, admin, code('CRS'), ga);
      const request = await openRequest(directorA, {
        requestType: 'COURSE_RELATION',
        targetType: 'COURSE',
        targetId: relation.id,
      });
      const wrongType = await directorA
        .put(`/api/change-requests/${request.id}/items`)
        .set(CSRF)
        .send({
          items: [
            {
              operation: 'ADD_MEMBER',
              lecturerId: coordAId,
              memberRole: 'MEMBER',
              validFrom: toIsoDay(todayDate()),
            },
          ],
        })
        .expect(400);
      expect(wrongType.body.code).toBe('OPERATION_NOT_FOR_TYPE');
    });
  });

  describe('a course used by three programs', () => {
    it('needs the director of every program and lists them before submit (KB-042, US-057 AC3, AC7, US-055 AC3)', async () => {
      const course = await publishedCourse(app, admin, code('CRX'), ga);
      const directors: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const account = await createAccount(app, `crdir3${index}`);
        directors.push(account.id);
        const program = await releasedProgram(app, admin, code('CRP'), [
          course.id,
        ]);
        await assignDirector(app, {
          programId: program.programId,
          userId: account.id,
        });
      }
      const missingBasis = await postRequest(memberA, {
        ...syllabusBody(course.id),
        origin: 'UNIVERSITY',
      }).expect(400);
      expect(missingBasis.body.code).toBe('VALIDATION_FAILED');
      const created = await openRequest(memberA, {
        ...syllabusBody(course.id),
        origin: 'UNIVERSITY',
        basisDocumentNumber: '123/QĐ-ĐHBK',
      });
      await editCopy(memberA, created.workspace!.copyId);
      const preview = (
        await memberA
          .get(`/api/change-requests/${created.id}/submit-preview`)
          .expect(200)
      ).body;
      expect(preview.affectedPrograms).toHaveLength(3);
      expect(
        preview.levels.map(
          (level: { approvalLevel: number }) => level.approvalLevel,
        ),
      ).toEqual([1, 2, 3]);
      expect(preview.levels[1].approvers).toHaveLength(3);

      const submitted = (await submitRequest(memberA, created.id).expect(200))
        .body;
      expect(submitted.status).toBe('PENDING_COORDINATOR');
      const level2 = rows(submitted.steps, 2) as {
        approver: { id: string };
        forProgram: { programCode: string };
      }[];
      expect(level2.map((step) => step.approver.id).sort()).toEqual(
        [...directors].sort(),
      );
      expect(rows(submitted.steps, 1)).toEqual([
        expect.objectContaining({
          approver: expect.objectContaining({ id: coordAId }),
        }),
      ]);

      // US-058: the second request on the same course is allowed and names the first; another course shows none.
      const other = await publishedCourse(app, admin, code('CRS'), ga);
      const second = await openRequest(memberA2, syllabusBody(course.id));
      expect(second.conflicts).toEqual([
        expect.objectContaining({
          requestCode: created.requestCode,
          status: 'PENDING_COORDINATOR',
        }),
      ]);
      const apart = await openRequest(memberA2, syllabusBody(other.id));
      expect(apart.conflicts).toEqual([]);
      const asked = await memberA2
        .get(
          `/api/change-requests/conflicts?targetType=COURSE&targetId=${course.id}`,
        )
        .expect(200);
      expect(asked.body).toHaveLength(2);
    });
  });

  describe('withdrawing, deleting and resubmitting', () => {
    it('withdraws a pending request, drops its copy and leaves it view-only (US-059 AC1, AC4)', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      const created = await openRequest(memberA, syllabusBody(course.id));
      await editCopy(memberA, created.workspace!.copyId);
      await submitRequest(memberA, created.id).expect(200);
      const withdrawn = (
        await memberA
          .post(`/api/change-requests/${created.id}/withdraw`)
          .set(CSRF)
          .expect(200)
      ).body;
      expect(withdrawn.status).toBe('WITHDRAWN');
      // F-14: a closed request has no use for its copy; the stored items keep the diff readable.
      expect(
        await prisma.syllabus.count({ where: { sourceRequestId: created.id } }),
      ).toBe(0);
      await memberA
        .patch(`/api/syllabi/${created.workspace!.copyId}`)
        .set(CSRF)
        .send({ objectives: '<p>Sau khi rút</p>' })
        .expect(404);
      await memberA.get(`/api/change-requests/${created.id}/diff`).expect(200);
      const again = await memberA
        .post(`/api/change-requests/${created.id}/withdraw`)
        .set(CSRF)
        .expect(409);
      expect(again.body.code).toBe('WITHDRAW_NOT_ALLOWED');
    });

    it('refuses withdrawal once a non-skipped row approved, allows it when only a skipped row did (US-059 AC2, AC3)', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      const created = await openRequest(memberA, syllabusBody(course.id));
      await editCopy(memberA, created.workspace!.copyId);
      await submitRequest(memberA, created.id).expect(200);
      await approveAs(coordA, created.id);
      const refused = await memberA
        .post(`/api/change-requests/${created.id}/withdraw`)
        .set(CSRF)
        .expect(409);
      expect(refused.body.code).toBe('WITHDRAW_NOT_ALLOWED');

      // The coordinator files for their own group: their level-1 row is the creator's, skipped.
      const own = await publishedCourse(app, admin, code('CRS'), ga);
      const request = await openRequest(coordA, syllabusBody(own.id));
      await editCopy(coordA, request.workspace!.copyId);
      const submitted = (await submitRequest(coordA, request.id).expect(200))
        .body;
      expect(submitted.status).toBe('PENDING_ACADEMIC_OFFICE');
      expect(rows(submitted.steps, 1)[0]).toMatchObject({
        isSkipped: true,
        skipReason: 'Người duyệt là người tạo đề xuất',
      });
      await coordA
        .post(`/api/change-requests/${request.id}/withdraw`)
        .set(CSRF)
        .expect(200);
    });

    it('deletes a never-submitted draft with its copy and files, not a returned one (US-054 AC3, AC4, US-057 AC6)', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      const created = await openRequest(memberA, syllabusBody(course.id));
      const uploaded = await memberA
        .post(`/api/change-requests/${created.id}/documents`)
        .set(CSRF)
        .field('documentType', 'SUBMISSION')
        .attach('file', PDF_BYTES, 'to-trinh.pdf')
        .expect(201);
      expect(uploaded.body).toMatchObject({
        documentType: 'SUBMISSION',
        canRemove: true,
        seenInRound: null,
      });
      const root = process.env.FILES_ROOT!;
      const filesOf = () =>
        existsSync(root)
          ? readdirSync(root, { recursive: true, withFileTypes: true }).filter(
              (entry) =>
                entry.isFile() && entry.parentPath.includes(created.id),
            )
          : [];
      expect(filesOf()).toHaveLength(1);
      await memberA
        .delete(`/api/change-requests/${created.id}`)
        .set(CSRF)
        .expect(204);
      expect(
        await prisma.syllabus.count({ where: { sourceRequestId: created.id } }),
      ).toBe(0);
      expect(
        await prisma.changeRequestDocument.count({
          where: { changeRequestId: created.id },
        }),
      ).toBe(0);
      expect(filesOf()).toHaveLength(0);
      await memberA.get(`/api/change-requests/${created.id}`).expect(404);

      const kept = await openRequest(memberA, syllabusBody(course.id));
      await editCopy(memberA, kept.workspace!.copyId);
      await submitRequest(memberA, kept.id).expect(200);
      await returnAs(coordA, kept.id);
      const refused = await memberA
        .delete(`/api/change-requests/${kept.id}`)
        .set(CSRF)
        .expect(409);
      expect(refused.body.code).toBe('REQUEST_NOT_DELETABLE');
      const resubmitted = (await submitRequest(memberA, kept.id).expect(200))
        .body;
      expect(resubmitted.submissionRound).toBe(2);
      expect(resubmitted.status).toBe('PENDING_COORDINATOR');
      expect(
        resubmitted.steps.every(
          (step: { action: string; isSkipped: boolean }) =>
            step.isSkipped || step.action === 'PENDING',
        ),
      ).toBe(true);
      expect(
        await prisma.approvalStep.count({
          where: { changeRequestId: kept.id },
        }),
      ).toBeGreaterThan(resubmitted.steps.length);
    });

    it('keeps a document removable until an approver could have seen it (US-056 AC3)', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      const created = await openRequest(memberA, syllabusBody(course.id));
      await editCopy(memberA, created.workspace!.copyId);
      const first = await memberA
        .post(`/api/change-requests/${created.id}/documents`)
        .set(CSRF)
        .field('documentType', 'MINUTES')
        .attach('file', PDF_BYTES, 'bien-ban.pdf')
        .expect(201);
      await submitRequest(memberA, created.id).expect(200);
      const locked = await memberA
        .delete(`/api/change-request-documents/${first.body.id}`)
        .set(CSRF)
        .expect(409);
      expect(locked.body.code).toBe('DOCUMENT_LOCKED');
      const later = await memberA
        .post(`/api/change-requests/${created.id}/documents`)
        .set(CSRF)
        .field('documentType', 'OFFICIAL_LETTER')
        .attach('file', PDF_BYTES, 'cong-van.pdf')
        .expect(201);
      expect(later.body.seenInRound).toBe(1);
      const bad = await memberA
        .post(`/api/change-requests/${created.id}/documents`)
        .set(CSRF)
        .field('documentType', 'MINUTES')
        .attach('file', Buffer.from('MZ not a pdf'), 'x.exe')
        .expect(400);
      expect(bad.body.code).toBe('ATTACHMENT_TYPE_NOT_ALLOWED');
      const download = await coordA
        .get(`/api/change-request-documents/${first.body.id}/file`)
        .expect(200);
      expect(download.headers['content-type']).toBe('application/pdf');
      await outsider
        .get(`/api/change-request-documents/${first.body.id}/file`)
        .expect(403);
    });
  });

  describe('organisational requests', () => {
    it('goes straight to the academic office and stays inside the coordinator own group (US-060)', async () => {
      const created = await openRequest(coordA, {
        requestType: 'ORGANIZATION',
        targetType: 'SUBJECT_GROUP',
        targetId: ga,
      });
      const options = await coordA
        .get('/api/change-requests/user-options?q=crmember')
        .expect(200);
      expect(options.body.length).toBeGreaterThanOrEqual(2);
      const memberId = options.body[0].id as string;
      const saved = await coordA
        .put(`/api/change-requests/${created.id}/items`)
        .set(CSRF)
        .send({
          items: [
            {
              operation: 'ADD_MEMBER',
              lecturerId: memberId,
              memberRole: 'MEMBER',
              validFrom: toIsoDay(todayDate()),
            },
          ],
        })
        .expect(200);
      expect(saved.body.authoredItems[0]).toMatchObject({
        entityType: 'ORG_MEMBERSHIP',
      });
      const submitted = (await submitRequest(coordA, created.id).expect(200))
        .body;
      expect(submitted.status).toBe('PENDING_ACADEMIC_OFFICE');
      expect(submitted.steps).toHaveLength(1);
      expect(submitted.steps[0].approvalLevel).toBe(3);

      const elsewhere = await postRequest(coordA, {
        requestType: 'ORGANIZATION',
        targetType: 'SUBJECT_GROUP',
        targetId: gb,
      }).expect(403);
      expect(elsewhere.body.code).toBe('OUT_OF_SCOPE');
      const r2 = await openRequest(viewer, {
        requestType: 'ORGANIZATION',
        targetType: 'SUBJECT_GROUP',
        targetId: ga,
      });
      expect(r2.status).toBe('DRAFT');
    });
  });

  describe('visibility and the academic-office credential', () => {
    it('shows a group member their own drafts and their group submitted requests only (D9)', async () => {
      const mine = await publishedCourse(app, admin, code('CRS'), ga);
      const theirs = await publishedCourse(app, admin, code('CRS'), gb);
      const privateDraft = await openRequest(memberA, syllabusBody(mine.id));
      const submittedElsewhere = await openRequest(
        admin,
        syllabusBody(theirs.id),
      );
      await editCopy(admin, submittedElsewhere.workspace!.copyId);
      await submitRequest(admin, submittedElsewhere.id).expect(200);
      const list = (
        await memberA2.get('/api/change-requests?pageSize=100').expect(200)
      ).body;
      const ids = list.items.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(privateDraft.id);
      expect(ids).not.toContain(submittedElsewhere.id);
      await memberA2.get(`/api/change-requests/${privateDraft.id}`).expect(404);
      const own = (
        await memberA
          .get('/api/change-requests?mine=true&pageSize=100')
          .expect(200)
      ).body;
      expect(own.items.map((item: { id: string }) => item.id)).toContain(
        privateDraft.id,
      );
      const filtered = (
        await admin
          .get('/api/change-requests?origin=UNIVERSITY&pageSize=100')
          .expect(200)
      ).body;
      expect(
        filtered.items.every(
          (item: { origin: string }) => item.origin === 'UNIVERSITY',
        ),
      ).toBe(true);
    });

    it('stores whether the creator held the academic-office role when the request was made (F-15 hook)', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      const byOffice = await openRequest(admin, syllabusBody(course.id));
      const byMember = await openRequest(memberA, syllabusBody(course.id));
      const flags = await prisma.changeRequest.findMany({
        where: { id: { in: [byOffice.id, byMember.id] } },
        select: { id: true, createdByAcademicOffice: true },
      });
      expect(
        flags.find((row) => row.id === byOffice.id)?.createdByAcademicOffice,
      ).toBe(true);
      expect(
        flags.find((row) => row.id === byMember.id)?.createdByAcademicOffice,
      ).toBe(false);
    });

    it('refuses to route a request of the only academic-office user to themselves (F13-01)', async () => {
      await prisma.roleAssignment.updateMany({
        where: { userId: admin2Id },
        data: { revokedAt: new Date() },
      });
      try {
        const course = await publishedCourse(app, admin, code('CRS'), ga);
        const created = await openRequest(admin, syllabusBody(course.id));
        await editCopy(admin, created.workspace!.copyId);
        const refused = await submitRequest(admin, created.id).expect(409);
        expect(refused.body.code).toBe('NO_OTHER_ACADEMIC_OFFICE');
        const preview = await admin
          .get(`/api/change-requests/${created.id}/submit-preview`)
          .expect(200);
        expect(preview.body.blockingIssues[0].code).toBe(
          'NO_OTHER_ACADEMIC_OFFICE',
        );
      } finally {
        await prisma.roleAssignment.updateMany({
          where: { userId: admin2Id },
          data: { revokedAt: null },
        });
      }
    });
  });

  describe('schema rules', () => {
    it('keeps the CHECKs, the code sequence and the copy-aware Draft indexes', async () => {
      const course = await publishedCourse(app, admin, code('CRS'), ga);
      await expect(
        prisma.changeRequest.create({
          data: {
            requestCode: 'DX-X-0001',
            requestType: 'SYLLABUS_CONTENT',
            targetType: 'COURSE',
            targetCode: 'X',
            courseId: course.id,
            createdById: coordAId,
            title: 'x',
            reason: 'x',
            origin: 'UNIVERSITY',
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.changeRequest.create({
          data: {
            requestCode: 'DX-X-0002',
            requestType: 'SYLLABUS_CONTENT',
            targetType: 'COURSE',
            targetCode: 'X',
            createdById: coordAId,
            title: 'x',
            reason: 'x',
            origin: 'FACULTY',
          },
        }),
      ).rejects.toThrow();

      // A copy does not count as the program's own Draft; a second plain Draft still does.
      const program = await releasedProgram(app, admin, code('CRP'), []);
      await assignDirector(app, {
        programId: program.programId,
        userId: directorAId,
      });
      const created = await openRequest(directorA, {
        requestType: 'PROGRAM_INFO',
        targetType: 'PROGRAM',
        targetId: program.programId,
      });
      const copy = await prisma.programVersion.findFirstOrThrow({
        where: { sourceRequestId: created.id },
      });
      const plain = {
        programId: program.programId,
        programName: 'P',
        majorCode: 'M',
        majorName: 'M',
        semesterCount: 8,
        totalCredits: '10',
        compulsoryCredits: '10',
        electiveCredits: '0',
      };
      await prisma.programVersion.create({
        data: { ...plain, status: ProgramVersionStatus.DRAFT },
      });
      await expect(
        prisma.programVersion.create({
          data: { ...plain, status: ProgramVersionStatus.DRAFT },
        }),
      ).rejects.toThrow();
      expect(copy.status).toBe(ProgramVersionStatus.DRAFT);
      // The info route reads the copy and writes it for its creator only.
      const info = await directorA
        .get(`/api/program-versions/${copy.id}/info`)
        .expect(200);
      expect(info.body).toMatchObject({
        canEdit: true,
        sourceRequest: { id: created.id },
      });
      await directorA
        .patch(`/api/program-versions/${copy.id}/info`)
        .set(CSRF)
        .send({ programName: 'Tên mới trong đề xuất' })
        .expect(200);
      await admin
        .patch(`/api/program-versions/${copy.id}/info`)
        .set(CSRF)
        .send({ programName: 'Người khác' })
        .expect(403);
      const programDetail = await admin
        .get(`/api/programs/${program.programId}`)
        .expect(200);
      expect(programDetail.body.programName).not.toBe('Tên mới trong đề xuất');

      const levels = await prisma.approvalLevelConfig.count();
      await seedApprovalLevels(prisma);
      expect(await prisma.approvalLevelConfig.count()).toBe(levels);
      expect(levels).toBe(3);
    });
  });
});
