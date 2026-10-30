import request from 'supertest';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { createCourse } from './fixtures/courses.js';
import { assignDirector } from './fixtures/programs.js';
import { createSemester } from './fixtures/releases.js';
import {
  GRADUATION_CSRF,
  completeGraduation,
  graduationHarness,
  graduationQuery,
  graduationWriteCounts,
  liveGraduation,
  saveGraduation,
  seedGraduationFixture,
  setGraduationResult,
} from './fixtures/graduation.js';

describe('graduation HTTP academic and immutable audit acceptance', () => {
  const harness = graduationHarness();

  it('returns version-one eligible JSON without writing on GET', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await completeGraduation(harness, fixture);
    const before = await harness.prisma.graduationAudit.count();
    const response = await liveGraduation(harness.office, fixture);
    expect(await harness.prisma.graduationAudit.count()).toBe(before);
    expect(response.body).toEqual({
      status: 'REVIEWED',
      error: null,
      result: {
        schemaVersion: 1,
        ruleVersion: 'graduation-v1',
        evaluatedAt: expect.any(String),
        context: {
          ...graduationQuery(fixture),
          studentId: fixture.studentId,
          enrollmentId: fixture.enrollmentId,
          studentCode: expect.any(String),
          fullName: expect.any(String),
          programCode: fixture.world.programCode,
          programName: expect.any(String),
          cohortId: fixture.cohortId,
          cohortCode: fixture.world.cohortCode,
          programVersionId: fixture.versionId,
          versionNumber: expect.any(String),
          semesterCode: fixture.world.laterSemesterCode,
          semesterStartDate: expect.any(String),
          versionSource: 'COHORT',
          cohortAssignmentId: expect.any(String),
        },
        conclusion: 'ELIGIBLE',
        shortfalls: [],
        warnings: expect.any(Array),
        credits: {
          requiredTotal: '9',
          recognizedTotal: '9',
          missingTotal: '0',
          compulsory: '3',
          elective: '6',
          free: '0',
        },
        electiveGroups: [
          {
            groupId: fixture.groupId,
            groupCode: 'TC',
            groupName: 'Nhóm tự chọn',
            requiredCredits: '6',
            earnedCredits: '6',
            missingCredits: '0',
            requiredCourses: 2,
            earnedCourses: 2,
            missingCourses: 0,
          },
        ],
        knowledgeBlocks: expect.any(Array),
        recognitions: expect.any(Array),
        freeCredits: [],
      },
    });
    expect(response.body.result.recognitions).toHaveLength(4);
    for (const recognition of response.body.result.recognitions) {
      expect(recognition).toEqual({
        curriculumItemId: expect.any(String),
        requiredCourse: expect.any(Object),
        studiedCourse: expect.any(Object),
        attemptId: expect.any(String),
        attemptRevision: 1,
        completionStatus: 'PASSED',
        viaEquivalence: false,
        equivalenceGroupId: null,
        requiredCredits: expect.any(String),
        recognizedCredits: expect.any(String),
        creditBasis: 'APPLIED_VERSION_SNAPSHOT',
        category: expect.stringMatching(
          /^(MANDATORY_COURSE|ELECTIVE_GROUP|CONDITIONAL_COURSE)$/,
        ),
        electiveGroupId:
          recognition.category === 'ELECTIVE_GROUP' ? fixture.groupId : null,
        blockSymbol: null,
      });
    }
    expect(JSON.stringify(response.body)).not.toMatch(
      /passwordHash|score4|score10|dataSource|operationKey/,
    );
  });

  it('emits all five stable shortfall codes with exact categories and decimal values', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const { body } = await liveGraduation(harness.office, fixture);
    expect(body.status).toBe('REVIEWED');
    expect(body.error).toBeNull();
    expect(body.result.conclusion).toBe('NOT_ELIGIBLE');
    expect(body.result.shortfalls).toHaveLength(5);
    expect(body.result.shortfalls).toEqual(
      expect.arrayContaining([
        {
          code: 'MANDATORY_COURSE_MISSING',
          category: 'MANDATORY_COURSE',
          curriculumItemId: fixture.itemIds.mandatory,
          course: expect.objectContaining({ id: fixture.courseIds.mandatory }),
          blockSymbol: null,
          reason: 'NOT_TAKEN',
          message: expect.any(String),
        },
        {
          code: 'CONDITIONAL_COURSE_MISSING',
          category: 'CONDITIONAL_COURSE',
          curriculumItemId: fixture.itemIds.conditional,
          course: expect.objectContaining({
            id: fixture.courseIds.conditional,
          }),
          blockSymbol: null,
          reason: 'NOT_TAKEN',
          message: expect.any(String),
        },
        {
          code: 'ELECTIVE_CREDITS_MISSING',
          category: 'ELECTIVE_GROUP',
          groupId: fixture.groupId,
          groupCode: 'TC',
          groupName: 'Nhóm tự chọn',
          requiredCredits: '6',
          earnedCredits: '0',
          missingCredits: '6',
          message: expect.any(String),
        },
        {
          code: 'ELECTIVE_COURSES_MISSING',
          category: 'ELECTIVE_GROUP',
          groupId: fixture.groupId,
          groupCode: 'TC',
          groupName: 'Nhóm tự chọn',
          requiredCourses: 2,
          earnedCourses: 0,
          missingCourses: 2,
          message: expect.any(String),
        },
        {
          code: 'TOTAL_CREDITS_MISSING',
          category: 'TOTAL_CREDITS',
          requiredCredits: '9',
          earnedCredits: '0',
          missingCredits: '9',
          message: expect.any(String),
        },
      ]),
    );
  });

  it('requires zero-credit mandatory and conditional courses independently', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office, {
      mandatoryCredits: '0',
    });
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.mandatory,
      'FAILED',
    );
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.conditional,
      'IN_PROGRESS',
    );
    const { body } = await liveGraduation(harness.office, fixture);
    expect(body.result.shortfalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MANDATORY_COURSE_MISSING',
          reason: 'FAILED',
          curriculumItemId: fixture.itemIds.mandatory,
        }),
        expect.objectContaining({
          code: 'CONDITIONAL_COURSE_MISSING',
          reason: 'IN_PROGRESS',
          curriculumItemId: fixture.itemIds.conditional,
        }),
      ]),
    );
    expect(
      body.result.shortfalls.filter(
        (row: { curriculumItemId?: string }) =>
          row.curriculumItemId === fixture.itemIds.conditional,
      ),
    ).toHaveLength(1);
  });

  it.each([
    {
      minCredits: '6',
      minCourses: null,
      missingCredits: '3',
      missingCourses: null,
    },
    {
      minCredits: null,
      minCourses: 2,
      missingCredits: null,
      missingCourses: 1,
    },
    { minCredits: '6', minCourses: 2, missingCredits: '3', missingCourses: 1 },
  ])(
    'preserves nullable minima and enforces each declared group minimum: %j',
    async (limits) => {
      const fixture = await seedGraduationFixture(
        harness.app,
        harness.office,
        limits,
      );
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.electiveA,
        'PASSED',
      );
      const { body } = await liveGraduation(harness.office, fixture);
      expect(body.result.electiveGroups).toEqual([
        {
          groupId: fixture.groupId,
          groupCode: 'TC',
          groupName: 'Nhóm tự chọn',
          requiredCredits: limits.minCredits,
          earnedCredits: '3',
          missingCredits: limits.missingCredits,
          requiredCourses: limits.minCourses,
          earnedCourses: 1,
          missingCourses: limits.missingCourses,
        },
      ]);
      const codes = body.result.shortfalls.map(
        (row: { code: string }) => row.code,
      );
      expect(codes.includes('ELECTIVE_CREDITS_MISSING')).toBe(
        limits.minCredits !== null,
      );
      expect(codes.includes('ELECTIVE_COURSES_MISSING')).toBe(
        limits.minCourses !== null,
      );
    },
  );

  it('trusts PASSED rather than the highest numeric retake and never frees repeated attempts', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await completeGraduation(harness, fixture);
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.mandatory,
      'PASSED',
      { score4: '0.5' },
    );
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.mandatory,
      'FAILED',
      { semesterId: fixture.semesterId, score4: '4' },
    );
    const { body } = await liveGraduation(harness.office, fixture);
    expect(body.result.conclusion).toBe('ELIGIBLE');
    expect(body.result.credits.recognizedTotal).toBe('9');
    expect(body.result.freeCredits).toEqual([]);
    expect(
      body.result.recognitions.filter(
        (row: { studiedCourse: { id: string } }) =>
          row.studiedCourse.id === fixture.courseIds.mandatory,
      ),
    ).toHaveLength(1);
  });

  it('recognizes old-code equivalence using actual credits and the exact credit gap', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const substitute = await createCourse(harness.app, {
      courseCode: 'SYN-GRAD-OLD',
      credits: '2',
    });
    const bridge = await createCourse(harness.app, {
      courseCode: 'SYN-GRAD-BRIDGE',
      credits: '3',
    });
    await harness.office
      .post('/api/equivalence-groups')
      .set(GRADUATION_CSRF)
      .send({
        groupCode: 'SYN-GRAD-EQ',
        courseIds: [fixture.courseIds.mandatory, bridge.id, substitute.id],
      })
      .expect(201);
    for (const key of ['conditional', 'electiveA', 'electiveB'] as const) {
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds[key],
        'PASSED',
      );
    }
    await setGraduationResult(harness, fixture, substitute.id, 'PASSED');
    const { body } = await liveGraduation(harness.office, fixture);
    expect(body.result.credits).toMatchObject({
      recognizedTotal: '8',
      missingTotal: '1',
    });
    expect(body.result.shortfalls).toEqual([
      expect.objectContaining({
        code: 'TOTAL_CREDITS_MISSING',
        missingCredits: '1',
      }),
    ]);
    expect(body.result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EQUIVALENT_CREDIT_GAP',
          creditGap: '1',
          curriculumItemId: fixture.itemIds.mandatory,
        }),
      ]),
    );
    expect(body.result.recognitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studiedCourse: expect.objectContaining({ id: substitute.id }),
          viaEquivalence: true,
          requiredCredits: '3',
          recognizedCredits: '2',
          creditBasis: 'CURRENT_CATALOG',
        }),
      ]),
    );
  });

  it('does not round fractional deficits', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office, {
      mandatoryCredits: '2.75',
    });
    await completeGraduation(harness, fixture);
    const { body } = await liveGraduation(harness.office, fixture);
    expect(body.result.credits).toMatchObject({
      recognizedTotal: '8.75',
      missingTotal: '0.25',
    });
    expect(body.result.shortfalls).toEqual([
      expect.objectContaining({
        code: 'TOTAL_CREDITS_MISSING',
        missingCredits: '0.25',
      }),
    ]);
  });

  it('appends history, replays concurrently and rejects cross-context key reuse', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await completeGraduation(harness, fixture);
    const [first, replay] = await Promise.all([
      saveGraduation(harness.office, fixture, 'concurrent-save'),
      saveGraduation(harness.office, fixture, 'concurrent-save'),
    ]);
    expect(replay.id).toBe(first.id);
    expect(replay.result).toEqual(first.result);
    expect(first).toMatchObject({
      trigger: 'STAFF',
      auditedBy: { id: harness.account.id },
      supersedesId: null,
      enrollmentId: fixture.enrollmentId,
      programVersionId: fixture.versionId,
      freshness: 'CURRENT',
    });
    const second = await saveGraduation(harness.office, fixture, 'second-save');
    expect(second.supersedesId).toBe(first.id);
    expect(second.id).not.toBe(first.id);
    const context =
      await harness.prisma.graduationAuditContext.findUniqueOrThrow({
        where: { id: first.contextId },
      });
    expect(context.lastAuditId).toBe(second.id);
    const history = await harness.office
      .get(`/api/students/${fixture.studentId}/graduation-audits`)
      .query({ ...graduationQuery(fixture), page: 1, pageSize: 1 })
      .expect(200);
    expect(history.body).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 1,
      items: [{ id: second.id }],
    });
    await harness.office
      .post(`/api/students/${fixture.secondStudentId}/graduation-audits`)
      .set(GRADUATION_CSRF)
      .send({ ...graduationQuery(fixture), requestKey: 'concurrent-save' })
      .expect(409);
    expect(
      await harness.prisma.graduationAudit.count({
        where: { contextId: first.contextId },
      }),
    ).toBe(2);
    const stored = await harness.office
      .get(`/api/graduation-audits/${first.id}`)
      .expect(200);
    expect(stored.body.result).toEqual(first.result);
    expect(stored.body.supersedesId).toBeNull();
  });

  it('rolls back an unevaluable save and exposes the diagnostic null-result branch', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const unknownSemester = await createSemester(harness.app, null, 'GU');
    const lookup = { ...fixture, semesterId: unknownSemester.id };
    const before = await harness.prisma.graduationAuditContext.count();
    const live = await liveGraduation(harness.office, lookup);
    expect(live.body).toEqual({
      status: 'CANNOT_AUDIT',
      result: null,
      error: {
        code: 'SEMESTER_START_UNKNOWN',
        message: expect.any(String),
        enrollmentId: expect.toSatisfy(
          (value: unknown) => value === null || typeof value === 'string',
        ),
      },
    });
    const rejected = await harness.office
      .post(`/api/students/${fixture.studentId}/graduation-audits`)
      .set(GRADUATION_CSRF)
      .send({ ...graduationQuery(lookup), requestKey: 'invalid-save' })
      .expect(409);
    expect(rejected.body.code).toBe('SEMESTER_START_UNKNOWN');
    expect(await harness.prisma.graduationAuditContext.count()).toBe(before);
    expect(
      await harness.prisma.graduationAudit.count({
        where: { enrollmentId: fixture.enrollmentId },
      }),
    ).toBe(0);
  });

  it('enforces owning-R6 read only, directed-R3 scope and other-role denial without writes', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const user = await harness.prisma.user.findUniqueOrThrow({
      where: { id: fixture.studentUserId },
    });
    const own = await loginAgent(harness.app, {
      id: user.id,
      username: user.username,
      password: `${user.username}Pass1`,
    });
    await liveGraduation(own, fixture);
    await own
      .get(`/api/students/${fixture.secondStudentId}/graduation`)
      .query(graduationQuery(fixture))
      .expect(404);
    await own
      .post(`/api/students/${fixture.studentId}/graduation-audits`)
      .set(GRADUATION_CSRF)
      .send({ ...graduationQuery(fixture), requestKey: 'r6-forbidden' })
      .expect(403);
    for (const role of ['R2', 'R4', 'R5']) {
      const account = await createAccount(
        harness.app,
        `grad${role.toLowerCase()}`,
        role,
        {
          unitCode: 'KHOA_CNTT',
        },
      );
      const agent = await loginAgent(harness.app, account);
      const before = await harness.prisma.graduationAudit.count();
      await agent
        .get(`/api/students/${fixture.studentId}/graduation`)
        .query(graduationQuery(fixture))
        .expect(403);
      await agent
        .post(`/api/students/${fixture.studentId}/graduation-audits`)
        .set(GRADUATION_CSRF)
        .send({ ...graduationQuery(fixture), requestKey: `forbidden-${role}` })
        .expect(403);
      expect(await harness.prisma.graduationAudit.count()).toBe(before);
    }
    const directorAccount = await createAccount(
      harness.app,
      'graddirector',
      'R3',
      { unitCode: 'KHOA_CNTT' },
    );
    const director = await loginAgent(harness.app, directorAccount);
    await director
      .get(`/api/students/${fixture.studentId}/graduation`)
      .query(graduationQuery(fixture))
      .expect(404);
    await assignDirector(harness.app, {
      programId: fixture.programId,
      userId: directorAccount.id,
    });
    await liveGraduation(director, fixture);
    await saveGraduation(director, fixture, 'director-review');
    await director
      .get(`/api/students/${fixture.studentId}/graduation-reaudit-tasks`)
      .query(graduationQuery(fixture))
      .expect(403);
    await own
      .get('/api/graduation/student-options')
      .query(graduationQuery(fixture))
      .expect(403);
    await own
      .get('/api/graduation/program-options')
      .query({ semesterId: fixture.semesterId })
      .expect(403);
  });

  it('requires authentication, CSRF and an explicit lookup', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const before = await graduationWriteCounts(harness.prisma);
    await request(harness.app.getHttpServer())
      .get(`/api/students/${fixture.studentId}/graduation`)
      .query(graduationQuery(fixture))
      .expect(401);
    await harness.office
      .get(`/api/students/${fixture.studentId}/graduation`)
      .expect(400);
    await harness.office
      .post(`/api/students/${fixture.studentId}/graduation-audits`)
      .send({ ...graduationQuery(fixture), requestKey: 'no-csrf' })
      .expect(403);
    expect((await graduationWriteCounts(harness.prisma)).slice(0, 4)).toEqual(
      before.slice(0, 4),
    );
  });

  it('fences unconfirmed exemptions and competing equivalence buckets as operational diagnostics', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.mandatory,
      'EXEMPT',
    );
    const exempt = await liveGraduation(harness.office, fixture);
    expect(exempt.body).toEqual({
      status: 'CANNOT_AUDIT',
      result: null,
      error: {
        code: 'EXEMPTION_POLICY_UNCONFIRMED',
        message: expect.any(String),
        enrollmentId: null,
      },
    });
    await completeGraduation(harness, fixture);
    await harness.office
      .post('/api/equivalence-groups')
      .set(GRADUATION_CSRF)
      .send({
        groupCode: 'SYN-GRAD-AMBIG',
        courseIds: [fixture.courseIds.mandatory, fixture.courseIds.electiveA],
      })
      .expect(201);
    const ambiguous = await liveGraduation(harness.office, fixture);
    expect(ambiguous.body).toEqual({
      status: 'CANNOT_AUDIT',
      result: null,
      error: {
        code: 'EQUIVALENCE_ALLOCATION_AMBIGUOUS',
        message: expect.any(String),
        enrollmentId: null,
      },
    });
    await harness.office
      .post(`/api/students/${fixture.studentId}/graduation-audits`)
      .set(GRADUATION_CSRF)
      .send({ ...graduationQuery(fixture), requestKey: 'ambiguous-save' })
      .expect(409);
    expect(
      await harness.prisma.graduationAuditContext.count({
        where: { studentId: fixture.studentId },
      }),
    ).toBe(0);
  });

  it('counts a direct requirement once and a distinct equivalent course as free surplus', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const extra = await createCourse(harness.app, {
      courseCode: 'SYN-GRAD-SURPLUS',
      credits: '2',
    });
    await harness.office
      .post('/api/equivalence-groups')
      .set(GRADUATION_CSRF)
      .send({
        groupCode: 'SYN-GRAD-SURPLUS-EQ',
        courseIds: [fixture.courseIds.mandatory, extra.id],
      })
      .expect(201);
    await completeGraduation(harness, fixture);
    await setGraduationResult(harness, fixture, extra.id, 'PASSED');
    await setGraduationResult(harness, fixture, extra.id, 'PASSED', {
      semesterId: fixture.semesterId,
    });
    const { body } = await liveGraduation(harness.office, fixture);
    expect(body.result.credits).toMatchObject({
      recognizedTotal: '11',
      compulsory: '3',
      elective: '6',
      free: '2',
    });
    expect(body.result.freeCredits).toEqual([
      {
        course: expect.objectContaining({ id: extra.id }),
        attemptId: expect.any(String),
        credits: '2',
        creditBasis: 'CURRENT_CATALOG',
        reason: 'SURPLUS_EQUIVALENT',
      },
    ]);
  });

  it('keeps dual-major contexts independent and records the explicit exception version', async () => {
    const first = await seedGraduationFixture(harness.app, harness.office);
    const second = await seedGraduationFixture(harness.app, harness.office);
    await completeGraduation(harness, first);
    const student = await harness.prisma.student.findUniqueOrThrow({
      where: { id: first.studentId },
    });
    await harness.office
      .post(`/api/students/${first.studentId}/enrollments`)
      .set(GRADUATION_CSRF)
      .send({
        operation: 'ADD_SECOND_MAJOR',
        targetVersionId: second.versionId,
        fromSemesterId: second.priorSemesterId,
        basisDecision: 'QD-SYN-NGANH-HAI',
        expectedStudentUpdatedAt: student.updatedAt.toISOString(),
      })
      .expect(201);
    const secondLookup = {
      ...second,
      studentId: first.studentId,
      semesterId: first.semesterId,
    };
    const primary = await liveGraduation(harness.office, first);
    const secondary = await liveGraduation(harness.office, secondLookup);
    expect(primary.body.result).toMatchObject({
      conclusion: 'ELIGIBLE',
      context: { programVersionId: first.versionId, versionSource: 'COHORT' },
    });
    expect(secondary.body.result).toMatchObject({
      conclusion: 'NOT_ELIGIBLE',
      context: {
        programVersionId: second.versionId,
        versionSource: 'EXCEPTION',
        cohortAssignmentId: null,
      },
    });
    const savedFirst = await saveGraduation(harness.office, first, 'major-one');
    const savedSecond = await saveGraduation(
      harness.office,
      secondLookup,
      'major-two',
    );
    expect(savedSecond.contextId).not.toBe(savedFirst.contextId);
    expect(savedSecond.enrollmentId).not.toBe(savedFirst.enrollmentId);
  });

  it('reads transferred historical intervals without falling back to the active program', async () => {
    const first = await seedGraduationFixture(harness.app, harness.office);
    const second = await seedGraduationFixture(harness.app, harness.office);
    const transferSemester = await createSemester(
      harness.app,
      -200,
      'GTRANSFER',
    );
    const sourceEnrollment =
      await harness.prisma.programEnrollment.findUniqueOrThrow({
        where: { id: first.enrollmentId },
      });
    const student = await harness.prisma.student.findUniqueOrThrow({
      where: { id: first.studentId },
    });
    await harness.office
      .post(`/api/students/${first.studentId}/enrollments`)
      .set(GRADUATION_CSRF)
      .send({
        operation: 'TRANSFER',
        sourceEnrollmentId: sourceEnrollment.id,
        expectedEnrollmentUpdatedAt: sourceEnrollment.updatedAt.toISOString(),
        targetVersionId: second.versionId,
        fromSemesterId: transferSemester.id,
        basisDecision: 'QD-SYN-CHUYEN',
        expectedStudentUpdatedAt: student.updatedAt.toISOString(),
      })
      .expect(201);
    expect(
      (
        await harness.prisma.programEnrollment.findUniqueOrThrow({
          where: { id: first.enrollmentId },
        })
      ).status,
    ).toBe('TRANSFERRED');
    const historical = await liveGraduation(harness.office, first);
    expect(historical.body.result.context).toMatchObject({
      enrollmentId: first.enrollmentId,
      programVersionId: first.versionId,
    });
    const saved = await saveGraduation(
      harness.office,
      first,
      'transferred-history',
    );
    expect(saved.programVersionId).toBe(first.versionId);
    await harness.office
      .get(`/api/students/${first.studentId}/graduation`)
      .query({ ...graduationQuery(first), semesterId: transferSemester.id })
      .expect(404);
    const transferred = await liveGraduation(harness.office, {
      ...first,
      programId: second.programId,
      semesterId: transferSemester.id,
    });
    expect(transferred.body.result.context).toMatchObject({
      programId: second.programId,
      programVersionId: second.versionId,
    });
    expect(transferred.body.result.context.enrollmentId).not.toBe(
      first.enrollmentId,
    );
  });

  it('enforces context and operation uniqueness, reviewer CHECK, schema CHECK and audit foreign keys', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const saved = await saveGraduation(
      harness.office,
      fixture,
      'constraint-audit',
    );
    const context =
      await harness.prisma.graduationAuditContext.findUniqueOrThrow({
        where: { id: saved.contextId },
      });
    await expect(
      harness.prisma.graduationAuditContext.create({
        data: {
          studentId: context.studentId,
          programId: context.programId,
          semesterId: context.semesterId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const stored = await harness.prisma.graduationAudit.findUniqueOrThrow({
      where: { id: saved.id },
    });
    const { id: _id, ...data } = stored;
    const copy = {
      ...data,
      result:
        saved.result as unknown as import('../src/generated/prisma/client.js').Prisma.InputJsonValue,
      inputs:
        stored.inputs as import('../src/generated/prisma/client.js').Prisma.InputJsonValue,
      shortfalls:
        stored.shortfalls as import('../src/generated/prisma/client.js').Prisma.InputJsonValue,
    };
    await expect(
      harness.prisma.graduationAudit.create({ data: copy }),
    ).rejects.toMatchObject({ code: 'P2002' });
    for (const [index, invalid] of [
      { schemaVersion: 0 },
      { auditedById: null },
      { trigger: 'RESULT_CHANGE' as const },
      { contextId: 'missing-context' },
      { enrollmentId: 'missing-enrollment' },
      { programVersionId: 'missing-version' },
    ].entries()) {
      await expect(
        harness.prisma.graduationAudit.create({
          data: {
            ...copy,
            ...invalid,
            operationKey: `synthetic-invalid-${index}`,
          },
        }),
      ).rejects.toThrow();
    }
    expect(
      (
        await harness.prisma.graduationAuditContext.findUniqueOrThrow({
          where: { id: saved.contextId },
        })
      ).lastAuditId,
    ).toBe(saved.id);
  });

  it('rejects an unsupported stored schema instead of returning or recalculating it', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const saved = await saveGraduation(
      harness.office,
      fixture,
      'unknown-schema',
    );
    await harness.prisma.graduationAudit.update({
      where: { id: saved.id },
      data: {
        schemaVersion: 2,
        result: {
          ...saved.result,
          schemaVersion: 2,
        } as unknown as import('../src/generated/prisma/client.js').Prisma.InputJsonValue,
      },
    });
    const response = await harness.office
      .get(`/api/graduation-audits/${saved.id}`)
      .expect(409);
    expect(response.body.code).toBe('GRADUATION_UNSUPPORTED_SCHEMA_VERSION');
    expect(
      await harness.prisma.graduationAudit.count({
        where: { contextId: saved.contextId },
      }),
    ).toBe(1);
  });
});
