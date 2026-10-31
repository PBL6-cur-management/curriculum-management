import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedApprovalLevels } from '../prisma/seed-data/approval-levels.js';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import {
  PermissionMode,
  PermissionScope,
  ScopeType,
  SubjectGroupMemberRole,
} from '../src/generated/prisma/client.js';
import { PERMISSIONS } from '../src/shared/authz/permission-codes.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { todayDate } from '../src/shared/time/today.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  decide,
  openRequest,
  publishedCourse,
  readRequest,
  submitRequest,
} from './fixtures/change-requests.js';
import { createCourse } from './fixtures/courses.js';
import { addCurriculumItem } from './fixtures/curriculum.js';
import { createClo } from './fixtures/outcomes.js';
import { createProgram } from './fixtures/programs.js';
import {
  createSemester,
  isoDay,
  makeSyllabusReady,
  pastSemesterId,
  postRelease,
  releaseViaApi,
} from './fixtures/releases.js';
import {
  addMembership,
  createSubjectGroup,
} from './fixtures/subject-groups.js';
import { createSyllabusDraft } from './fixtures/syllabi.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

type Agent = ReturnType<typeof request.agent>;

interface FormulaBody {
  failingScore: string | null;
  totalWeight: string;
  components: {
    id: string;
    componentCode: string;
    weight: string;
    isConditional: boolean;
    conditionThreshold: string | null;
    mappings: { cloId: string; cloWeight: string | null }[];
  }[];
  warnings: { code: string; cloCode: string }[];
}

interface DraftBody {
  id: string;
  updatedAt: string;
  clos: { id: string; cloCode: string }[];
  gradingFormula: FormulaBody;
}

const component = (
  code: string,
  weight: string,
  extra: Record<string, unknown> = {},
) => ({
  componentCode: code,
  componentName: `Thành phần ${code}`,
  weight,
  isConditional: false,
  ...extra,
});

describe('grade formula and assessment-CLO mapping (F-12)', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let admin2: Agent;
  let viewer: Agent;
  let memberA: Agent;
  let coordA: Agent;
  let outsider: Agent;
  let gradeOnly: Agent;
  let textOnly: Agent;
  let ga: string;
  let counter = 0;
  const code = (prefix: string) => `${prefix}${(counter += 1)}`;

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
    ga = (await createSubjectGroup(app, 'GF_GA')).id;
    const gb = (await createSubjectGroup(app, 'GF_GB')).id;
    admin = await loginAgent(app, await createAccount(app, 'gfadmin', 'R1'));
    admin2 = await loginAgent(app, await createAccount(app, 'gfadmin2', 'R1'));
    viewer = await loginAgent(app, await createAccount(app, 'gfviewer', 'R2'));
    const memberAccount = await createAccount(app, 'gfmember');
    await addMembership(app, { groupId: ga, userId: memberAccount.id });
    memberA = await loginAgent(app, memberAccount);
    const coordAccount = await createAccount(app, 'gfcoord');
    for (const memberRole of [
      SubjectGroupMemberRole.MEMBER,
      SubjectGroupMemberRole.COORDINATOR,
    ]) {
      await addMembership(app, {
        groupId: ga,
        userId: coordAccount.id,
        memberRole,
      });
    }
    coordA = await loginAgent(app, coordAccount);
    const outsiderAccount = await createAccount(app, 'gfoutsider');
    await addMembership(app, { groupId: gb, userId: outsiderAccount.id });
    outsider = await loginAgent(app, outsiderAccount);
    gradeOnly = await loginAgent(
      app,
      await accountWithOnly('gfgrader', PERMISSIONS.GRADING_FORMULA_EDIT),
    );
    textOnly = await loginAgent(
      app,
      await accountWithOnly('gftexter', PERMISSIONS.SYLLABUS_EDIT),
    );
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  // A role holding one editing permission (plus the reads a Draft needs), system-wide and direct.
  async function accountWithOnly(username: string, edit: string) {
    const role = await prisma.role.create({
      data: { roleCode: `ONLY_${username}`, roleName: username },
    });
    for (const permissionCode of [edit, PERMISSIONS.PROGRAM_VIEW]) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { permissionCode },
      });
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          mode: PermissionMode.DIRECT,
          scope: PermissionScope.ALL,
        },
      });
    }
    const account = await createAccount(app, username);
    await prisma.roleAssignment.create({
      data: {
        userId: account.id,
        roleId: role.id,
        scopeType: ScopeType.SYSTEM,
        validFrom: todayDate(),
      },
    });
    return account;
  }

  const putFormula = (agent: Agent, syllabusId: string, body: object) =>
    agent
      .put(`/api/syllabi/${syllabusId}/grading-formula`)
      .set(CSRF)
      .send(body);
  const putMappings = (agent: Agent, syllabusId: string, body: object) =>
    agent
      .put(`/api/syllabi/${syllabusId}/assessment-clo-mappings`)
      .set(CSRF)
      .send(body);

  async function draftOf(
    agent: Agent,
    courseId: string,
    requestId?: string,
  ): Promise<DraftBody> {
    const query = requestId ? `?requestId=${requestId}` : '';
    return (
      await agent.get(`/api/courses/${courseId}/syllabus${query}`).expect(200)
    ).body.draft;
  }

  // A course in group A with a Draft and two CLOs; nothing else is stored.
  async function newDraft() {
    const course = await createCourse(app, {
      courseCode: code('GFC'),
      groupId: ga,
    });
    const draft = await createSyllabusDraft(admin, course.id);
    const clo1 = await createClo(admin, draft.id, 'CLO1');
    const clo2 = await createClo(admin, draft.id, 'CLO2');
    return { course, syllabusId: draft.id, clo1, clo2 };
  }

  const storedComponents = (syllabusId: string) =>
    prisma.assessmentComponent.findMany({
      where: { syllabusId },
      orderBy: { componentCode: 'asc' },
    });

  describe('the Draft saves in steps and tells the author what is missing', () => {
    it('saves a formula with an uncovered CLO and a named warning, then covers it by mapping', async () => {
      const { course, syllabusId, clo1, clo2 } = await newDraft();
      const first = await draftOf(admin, course.id);

      const saved = await putFormula(admin, syllabusId, {
        expectedUpdatedAt: first.updatedAt,
        failingScore: '4',
        components: [
          component('CK', '60', { assessmentForm: 'Thi viết' }),
          component('GK', '40', {
            isConditional: true,
            conditionThreshold: '5',
          }),
        ],
      }).expect(200);
      expect(saved.body).toMatchObject({
        failingScore: '4',
        totalWeight: '100',
      });
      expect(
        saved.body.warnings.map((w: { cloCode: string }) => w.cloCode),
      ).toEqual(['CLO1', 'CLO2']);

      const reread = await draftOf(admin, course.id);
      const [ck] = reread.gradingFormula.components;
      const mapped = await putMappings(admin, syllabusId, {
        expectedUpdatedAt: reread.updatedAt,
        mappings: [
          { assessmentComponentId: ck.id, cloId: clo1.id, cloWeight: null },
        ],
      }).expect(200);
      expect(mapped.body.warnings).toEqual([
        expect.objectContaining({
          code: 'ASSESSMENT_CLO_UNCOVERED',
          cloCode: clo2.cloCode,
        }),
      ]);
      expect(mapped.body.components[0].mappings).toEqual([
        { cloId: clo1.id, cloWeight: null },
      ]);
    });

    it('refuses a formula that does not total 100 and stores nothing of it', async () => {
      const { course, syllabusId } = await newDraft();
      const first = await draftOf(admin, course.id);
      await putFormula(admin, syllabusId, {
        expectedUpdatedAt: first.updatedAt,
        failingScore: null,
        components: [component('CK', '100')],
      }).expect(200);
      const current = await draftOf(admin, course.id);

      const refused = await putFormula(admin, syllabusId, {
        expectedUpdatedAt: current.updatedAt,
        failingScore: null,
        components: [component('CK', '70'), component('GK', '20')],
      }).expect(400);
      expect(refused.body.code).toBe('ASSESSMENT_WEIGHT_TOTAL_INVALID');

      const after = await storedComponents(syllabusId);
      expect(
        after.map((row) => [row.componentCode, row.weight.toString()]),
      ).toEqual([['CK', '100']]);
      expect((await draftOf(admin, course.id)).updatedAt).toBe(
        current.updatedAt,
      );
    });

    it('keeps retained ids and their links through a code swap, drops omitted components and their links', async () => {
      const { course, syllabusId, clo1 } = await newDraft();
      let draft = await draftOf(admin, course.id);
      await putFormula(admin, syllabusId, {
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [
          component('A', '50'),
          component('B', '30'),
          component('C', '20'),
        ],
      }).expect(200);
      draft = await draftOf(admin, course.id);
      const [a, b, c] = draft.gradingFormula.components;
      await putMappings(admin, syllabusId, {
        expectedUpdatedAt: draft.updatedAt,
        mappings: [
          { assessmentComponentId: a.id, cloId: clo1.id, cloWeight: '100' },
          { assessmentComponentId: c.id, cloId: clo1.id, cloWeight: '50' },
        ],
      }).expect(200);
      draft = await draftOf(admin, course.id);

      const swapped = await putFormula(admin, syllabusId, {
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [
          { ...component('B', '50'), id: a.id },
          { ...component('A', '50'), id: b.id },
        ],
      }).expect(200);

      const byId = new Map(
        swapped.body.components.map(
          (row: FormulaBody['components'][number]) => [row.id, row],
        ),
      );
      expect([...byId.keys()].sort()).toEqual([a.id, b.id].sort());
      expect(byId.get(a.id)).toMatchObject({
        componentCode: 'B',
        mappings: [{ cloId: clo1.id, cloWeight: '100' }],
      });
      expect(
        await prisma.assessmentCLOMapping.count({
          where: { assessmentComponentId: c.id },
        }),
      ).toBe(0);
    });

    it('names each refusal: duplicate code, foreign ids, missing threshold, bad cells, duplicate cell and a stale token', async () => {
      const { course, syllabusId, clo1 } = await newDraft();
      const other = await newDraft();
      let draft = await draftOf(admin, course.id);
      await putFormula(admin, syllabusId, {
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [component('CK', '100')],
      }).expect(200);
      draft = await draftOf(admin, course.id);
      const [ck] = draft.gradingFormula.components;
      const token = { expectedUpdatedAt: draft.updatedAt };
      const base = { ...token, failingScore: null };

      expect(
        (
          await putFormula(admin, syllabusId, {
            ...base,
            components: [component('CK', '50'), component('CK', '50')],
          }).expect(400)
        ).body.code,
      ).toBe('ASSESSMENT_CODE_DUPLICATE');
      expect(
        (
          await putFormula(admin, syllabusId, {
            ...base,
            components: [component('CK', '100', { isConditional: true })],
          }).expect(400)
        ).body.code,
      ).toBe('ASSESSMENT_CONDITION_THRESHOLD_REQUIRED');
      expect(
        (
          await putFormula(admin, syllabusId, {
            ...base,
            components: [{ ...component('CK', '100'), id: 'not-mine' }],
          }).expect(400)
        ).body.code,
      ).toBe('ASSESSMENT_ID_INVALID');

      const foreignClo = other.clo1.id;
      expect(
        (
          await putMappings(admin, syllabusId, {
            ...token,
            mappings: [
              {
                assessmentComponentId: ck.id,
                cloId: foreignClo,
                cloWeight: null,
              },
            ],
          }).expect(400)
        ).body.code,
      ).toBe('ASSESSMENT_MAPPING_INVALID');
      const cell = { assessmentComponentId: ck.id, cloId: clo1.id };
      expect(
        (
          await putMappings(admin, syllabusId, {
            ...token,
            mappings: [cell, cell],
          }).expect(400)
        ).body.code,
      ).toBe('ASSESSMENT_MAPPING_INVALID');

      await putMappings(admin, syllabusId, {
        ...token,
        mappings: [cell],
      }).expect(200);
      expect(
        (
          await putMappings(admin, syllabusId, {
            ...token,
            mappings: [],
          }).expect(409)
        ).body.code,
      ).toBe('ASSESSMENT_STALE');
      expect(
        await prisma.assessmentCLOMapping.count({
          where: { assessmentComponentId: ck.id },
        }),
      ).toBe(1);
    });

    it('drops a threshold sent for a component that is not conditional', async () => {
      const { course, syllabusId } = await newDraft();
      const draft = await draftOf(admin, course.id);
      const saved = await putFormula(admin, syllabusId, {
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [component('CK', '100', { conditionThreshold: '5' })],
      }).expect(200);
      expect(saved.body.components[0].conditionThreshold).toBeNull();
    });

    it('removes mappings with a deleted CLO and recomputes the warnings', async () => {
      const { course, syllabusId, clo1, clo2 } = await newDraft();
      let draft = await draftOf(admin, course.id);
      await putFormula(admin, syllabusId, {
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [component('CK', '100')],
      }).expect(200);
      draft = await draftOf(admin, course.id);
      const [ck] = draft.gradingFormula.components;
      await putMappings(admin, syllabusId, {
        expectedUpdatedAt: draft.updatedAt,
        mappings: [
          { assessmentComponentId: ck.id, cloId: clo1.id },
          { assessmentComponentId: ck.id, cloId: clo2.id },
        ],
      }).expect(200);
      expect((await draftOf(admin, course.id)).gradingFormula.warnings).toEqual(
        [],
      );

      await admin.delete(`/api/clos/${clo2.id}`).set(CSRF).expect(204);
      expect(
        await prisma.assessmentCLOMapping.count({ where: { cloId: clo2.id } }),
      ).toBe(0);

      const extra = await createClo(admin, syllabusId, 'CLO3');
      const after = await draftOf(admin, course.id);
      expect(after.gradingFormula.warnings).toEqual([
        expect.objectContaining({ cloCode: extra.cloCode }),
      ]);
    });
  });

  describe('who may write', () => {
    it('refuses R2, wrong-group staff, a missing token, no session and a released revision', async () => {
      const { course, syllabusId } = await newDraft();
      const draft = await draftOf(admin, course.id);
      const body = {
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [component('CK', '100')],
      };

      expect(
        (await putFormula(viewer, syllabusId, body).expect(403)).body.code,
      ).toBe('PERMISSION_DENIED');
      expect(
        (await putFormula(outsider, syllabusId, body).expect(403)).body.code,
      ).toBe('OUT_OF_SCOPE');
      await request(app.getHttpServer())
        .put(`/api/syllabi/${syllabusId}/grading-formula`)
        .set(CSRF)
        .send(body)
        .expect(401);
      await admin
        .put(`/api/syllabi/${syllabusId}/grading-formula`)
        .send(body)
        .expect(403);
      expect(await storedComponents(syllabusId)).toHaveLength(0);

      await makeSyllabusReady(admin, course.id);
      const carrier = await createProgram(app, { programCode: code('GFR') });
      await addCurriculumItem(admin, carrier.versions[0].id, {
        courseId: course.id,
        plannedSemester: 1,
      });
      await releaseViaApi(app, admin, {
        programId: carrier.id,
        versionId: carrier.versions[0].id,
        prepareSyllabi: false,
      });
      const released = await admin
        .get(`/api/courses/${course.id}/syllabus`)
        .expect(200);
      expect(released.body.gradingEditPath).toBe('VIA_REQUEST');
      const direct = await putFormula(admin, released.body.published.id, {
        ...body,
        expectedUpdatedAt: released.body.published.updatedAt,
      });
      expect(direct.status).toBe(409);
    });

    it('lets a grading-only holder write the formula but not the text, and a text-only holder the reverse', async () => {
      const { course, syllabusId } = await newDraft();
      const draft = await draftOf(admin, course.id);
      const body = {
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [component('CK', '100')],
      };

      await putFormula(gradeOnly, syllabusId, body).expect(200);
      expect(
        (
          await gradeOnly
            .patch(`/api/syllabi/${syllabusId}`)
            .set(CSRF)
            .send({ objectives: '<p>x</p>' })
            .expect(403)
        ).body.code,
      ).toBe('PERMISSION_DENIED');

      expect(
        (await putFormula(textOnly, syllabusId, body).expect(403)).body.code,
      ).toBe('PERMISSION_DENIED');
      await textOnly
        .patch(`/api/syllabi/${syllabusId}`)
        .set(CSRF)
        .send({ objectives: '<p>Mục tiêu</p>' })
        .expect(200);
    });
  });

  describe('a grading-formula request on a released course', () => {
    const level3 = async (requestId: string) => {
      for (let round = 0; round < 4; round += 1) {
        if (
          (await readRequest(admin, requestId)).status ===
          'PENDING_ACADEMIC_OFFICE'
        ) {
          return;
        }
        await decide(coordA, requestId, 'approve');
      }
      expect((await readRequest(admin, requestId)).status).toBe(
        'PENDING_ACADEMIC_OFFICE',
      );
    };

    const finalApprove = (
      agent: Agent,
      requestId: string,
      semesterId: string,
      extra: object = {},
    ) =>
      agent
        .post(`/api/change-requests/${requestId}/final-approve`)
        .set(CSRF)
        .send({
          decisionNumber: 'QD-GF/2026',
          signedDate: isoDay(-1),
          effectiveSemesterId: semesterId,
          ...extra,
        });

    // Course with one CLO, released in the given number of programs; its formula is the fixture's single 100% component.
    async function releasedCourse(programCount: number) {
      const course = await createCourse(app, {
        courseCode: code('GFX'),
        groupId: ga,
      });
      const draft = await createSyllabusDraft(admin, course.id);
      const clo = await createClo(admin, draft.id, 'CLO1');
      const programs: { programId: string; versionId: string }[] = [];
      for (let index = 0; index < programCount; index += 1) {
        const program = await createProgram(app, { programCode: code('GFP') });
        const versionId = program.versions[0].id;
        await addCurriculumItem(admin, versionId, {
          courseId: course.id,
          plannedSemester: 1,
        });
        await releaseViaApi(app, admin, { programId: program.id, versionId });
        programs.push({ programId: program.id, versionId });
      }
      return { course, clo, firstRevision: draft.id, programs };
    }

    const versionsOf = (programId: string) =>
      prisma.programVersion.findMany({
        where: { programId, sourceRequestId: null },
        orderBy: { createdAt: 'asc' },
      });

    async function openGradingRequest(
      creator: Agent,
      courseId: string,
      requestType = 'GRADING_FORMULA',
    ) {
      const created = await openRequest(creator, {
        requestType,
        targetType: 'COURSE',
        targetId: courseId,
      });
      return { requestId: created.id, copyId: created.workspace!.copyId };
    }

    it('refuses submit while a CLO added on the copy is not covered, and submits once it is', async () => {
      const { course } = await releasedCourse(1);
      const { requestId, copyId } = await openGradingRequest(
        memberA,
        course.id,
      );
      const added = await memberA
        .post(`/api/syllabi/${copyId}/clos`)
        .set(CSRF)
        .send({ cloCode: 'CLO2', description: 'Mới' })
        .expect(201);

      const refused = await submitRequest(memberA, requestId).expect(409);
      expect(refused.body.code).toBe('ASSESSMENT_NOT_READY');

      const copy = await draftOf(memberA, course.id, requestId);
      const [ck] = copy.gradingFormula.components;
      const mappings = [
        ...ck.mappings.map((m) => ({ assessmentComponentId: ck.id, ...m })),
        { assessmentComponentId: ck.id, cloId: added.body.id, cloWeight: null },
      ];
      await putMappings(memberA, copyId, {
        expectedUpdatedAt: copy.updatedAt,
        mappings,
      }).expect(200);
      await submitRequest(memberA, requestId).expect(200);
    });

    it('releases a new revision and one minor version per program, keeping old pins and weights, remapping links to the new CLOs', async () => {
      const { course, firstRevision, programs } = await releasedCourse(2);
      const { requestId, copyId } = await openGradingRequest(
        memberA,
        course.id,
      );
      const copy = await draftOf(memberA, course.id, requestId);
      const [ck] = copy.gradingFormula.components;
      await putFormula(memberA, copyId, {
        expectedUpdatedAt: copy.updatedAt,
        failingScore: '4',
        components: [
          {
            ...component('GK', '60'),
            id: ck.id,
            componentCode: ck.componentCode,
          },
          component('ZZ', '40'),
        ].map((row, index) => (index === 0 ? { ...row, weight: '60' } : row)),
      }).expect(200);
      await submitRequest(memberA, requestId).expect(200);
      await level3(requestId);

      const semester = await createSemester(app, 60);
      const approved = await finalApprove(admin, requestId, semester.id).expect(
        200,
      );
      expect(approved.body.release.versions).toHaveLength(2);

      const revisions = await prisma.syllabus.findMany({
        where: { courseId: course.id },
        orderBy: { revisionNumber: 'asc' },
      });
      expect(revisions.map((r) => [r.revisionNumber, r.status])).toEqual([
        [1, 'HISTORICAL'],
        [2, 'PUBLISHED'],
      ]);
      expect(revisions[1]!.failingScore?.toString()).toBe('4');
      const oldWeights = await storedComponents(firstRevision);
      expect(oldWeights.map((r) => r.weight.toString())).toEqual(['100']);
      const newComponents = await prisma.assessmentComponent.findMany({
        where: { syllabusId: revisions[1]!.id },
        include: { mappings: { include: { clo: true } } },
      });
      expect(newComponents.map((r) => r.weight.toString()).sort()).toEqual([
        '40',
        '60',
      ]);
      const carried = newComponents.flatMap((row) => row.mappings);
      expect(carried).toHaveLength(1);
      expect(carried[0]!.clo.syllabusId).toBe(revisions[1]!.id);

      for (const { programId } of programs) {
        const [oldVersion, newVersion] = await versionsOf(programId);
        expect(newVersion).toMatchObject({
          versionNumber: '1.1',
          status: 'PENDING',
        });
        const oldRow = await prisma.curriculumItem.findFirstOrThrow({
          where: { versionId: oldVersion!.id },
        });
        const newRow = await prisma.curriculumItem.findFirstOrThrow({
          where: { versionId: newVersion!.id },
        });
        expect(oldRow.syllabusId).toBe(firstRevision);
        expect(newRow.syllabusId).toBe(revisions[1]!.id);
        const asOld = await admin
          .get(`/api/courses/${course.id}/syllabus?versionId=${oldVersion!.id}`)
          .expect(200);
        expect(asOld.body.published.gradingFormula.components).toHaveLength(1);
      }
    });

    it('does not mistake a failing-score-only change for no change', async () => {
      const course = await publishedCourse(app, admin, code('GFN'), ga);
      const { requestId, copyId } = await openGradingRequest(
        memberA,
        course.id,
      );
      const copy = await draftOf(memberA, course.id, requestId);
      const [ck] = copy.gradingFormula.components;
      await putFormula(memberA, copyId, {
        expectedUpdatedAt: copy.updatedAt,
        failingScore: '4',
        components: [{ ...component(ck.componentCode, '100'), id: ck.id }],
      }).expect(200);

      await submitRequest(memberA, requestId).expect(200);
    });

    it('refuses a started semester for grading changes even from the academic office with the flag, and keeps the exception for other changes', async () => {
      const { course } = await releasedCourse(1);
      const past = await createSemester(app, -90);

      const grading = await openGradingRequest(admin2, course.id);
      const copy = await draftOf(admin2, course.id, grading.requestId);
      const [ck] = copy.gradingFormula.components;
      await putFormula(admin2, grading.copyId, {
        expectedUpdatedAt: copy.updatedAt,
        failingScore: '3',
        components: [{ ...component(ck.componentCode, '100'), id: ck.id }],
      }).expect(200);
      await submitRequest(admin2, grading.requestId).expect(200);
      await level3(grading.requestId);
      const preview = await admin
        .get(`/api/change-requests/${grading.requestId}/final-approval`)
        .expect(200);
      expect(preview.body.canAllowPastSemester).toBe(false);
      const refused = await finalApprove(admin, grading.requestId, past.id, {
        allowPastSemester: true,
      }).expect(409);
      expect(refused.body.code).toBe('SEMESTER_ALREADY_STARTED');

      const embedded = await openGradingRequest(
        admin2,
        course.id,
        'SYLLABUS_CONTENT',
      );
      const embeddedCopy = await draftOf(admin2, course.id, embedded.requestId);
      const [row] = embeddedCopy.gradingFormula.components;
      await putFormula(admin2, embedded.copyId, {
        expectedUpdatedAt: embeddedCopy.updatedAt,
        failingScore: '2',
        components: [{ ...component(row.componentCode, '100'), id: row.id }],
      }).expect(200);
      await submitRequest(admin2, embedded.requestId).expect(200);
      await level3(embedded.requestId);
      const embeddedRefused = await finalApprove(
        admin,
        embedded.requestId,
        past.id,
        { allowPastSemester: true },
      ).expect(409);
      expect(embeddedRefused.body.code).toBe('SEMESTER_ALREADY_STARTED');

      const content = await openGradingRequest(
        admin2,
        course.id,
        'SYLLABUS_CONTENT',
      );
      await admin2
        .patch(`/api/syllabi/${content.copyId}`)
        .set(CSRF)
        .send({ objectives: '<p>Chỉ sửa mục tiêu</p>' })
        .expect(200);
      await submitRequest(admin2, content.requestId).expect(200);
      await level3(content.requestId);
      const allowed = await admin
        .get(`/api/change-requests/${content.requestId}/final-approval`)
        .expect(200);
      expect(allowed.body.canAllowPastSemester).toBe(true);
    });
  });

  describe('publication and submission cannot be raced into an incomplete state', () => {
    it('serialises a mapping save against a component deletion', async () => {
      const { course, syllabusId, clo1 } = await newDraft();
      let draft = await draftOf(admin, course.id);
      await putFormula(admin, syllabusId, {
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [component('A', '50'), component('B', '50')],
      }).expect(200);
      draft = await draftOf(admin, course.id);
      const [a, b] = draft.gradingFormula.components;

      const [mapping, deletion] = await Promise.all([
        putMappings(admin, syllabusId, {
          expectedUpdatedAt: draft.updatedAt,
          mappings: [{ assessmentComponentId: b.id, cloId: clo1.id }],
        }),
        putFormula(admin2, syllabusId, {
          expectedUpdatedAt: draft.updatedAt,
          failingScore: null,
          components: [{ ...component('A', '100'), id: a.id }],
        }),
      ]);

      expect([mapping.status, deletion.status].sort()).toEqual([200, 409]);
      const loser = mapping.status === 409 ? mapping : deletion;
      expect(loser.body.code).toBe('ASSESSMENT_STALE');
      const links = await prisma.assessmentCLOMapping.findMany({
        where: { assessmentComponent: { syllabusId } },
      });
      for (const link of links) {
        expect(
          await prisma.assessmentComponent.count({
            where: { id: link.assessmentComponentId },
          }),
        ).toBe(1);
      }
    });

    it('never publishes a revision whose CLO lost its coverage while the release ran', async () => {
      const { course, syllabusId } = await newDraft();
      await makeSyllabusReady(admin, course.id);
      const program = await createProgram(app, { programCode: code('GFQ') });
      const versionId = program.versions[0].id;
      await addCurriculumItem(admin, versionId, {
        courseId: course.id,
        plannedSemester: 1,
      });
      const draft = await draftOf(admin, course.id);

      const [released, cleared] = await Promise.all([
        postRelease(app, admin, {
          programId: program.id,
          versionId,
          semesterId: await pastSemesterId(app),
        }),
        putMappings(admin2, syllabusId, {
          expectedUpdatedAt: draft.updatedAt,
          mappings: [],
        }),
      ]);

      expect([201, 409]).toContain(released.status);
      expect([200, 409]).toContain(cleared.status);
      const published = await prisma.syllabus.findFirst({
        where: { courseId: course.id, status: 'PUBLISHED' },
        include: { clos: { include: { assessmentLinks: true } } },
      });
      if (published) {
        for (const clo of published.clos) {
          expect(clo.assessmentLinks.length).toBeGreaterThan(0);
        }
      } else {
        expect(released.status).toBe(409);
      }
    });

    it('never submits a copy that lost a CLO mapping while the submit ran', async () => {
      const course = await publishedCourse(app, admin, code('GFS'), ga);
      const { requestId, copyId } = await (async () => {
        const created = await openRequest(memberA, {
          requestType: 'GRADING_FORMULA',
          targetType: 'COURSE',
          targetId: course.id,
        });
        return { requestId: created.id, copyId: created.workspace!.copyId };
      })();
      const added = await memberA
        .post(`/api/syllabi/${copyId}/clos`)
        .set(CSRF)
        .send({ cloCode: 'CLO1', description: 'Mới' })
        .expect(201);
      const copy = await draftOf(memberA, course.id, requestId);
      const [ck] = copy.gradingFormula.components;
      await putMappings(memberA, copyId, {
        expectedUpdatedAt: copy.updatedAt,
        mappings: [
          {
            assessmentComponentId: ck.id,
            cloId: added.body.id,
            cloWeight: null,
          },
        ],
      }).expect(200);
      const latest = await draftOf(memberA, course.id, requestId);

      const [submitted, cleared] = await Promise.all([
        submitRequest(memberA, requestId),
        putMappings(memberA, copyId, {
          expectedUpdatedAt: latest.updatedAt,
          mappings: [],
        }),
      ]);

      expect([200, 409]).toContain(submitted.status);
      expect([200, 409]).toContain(cleared.status);
      // A request that lost the race stays a Draft, which only its creator can read.
      const status = (await readRequest(memberA, requestId)).status;
      if (status !== 'DRAFT') {
        const rows = await prisma.assessmentCLOMapping.count({
          where: { cloId: added.body.id },
        });
        expect(rows).toBe(1);
      }
    });
  });
});
