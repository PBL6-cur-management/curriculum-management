import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  graduationHarness,
  graduationQuery,
  graduationWriteCounts,
  seedGraduationFixture,
  setGraduationResult,
  type GraduationFixture,
  type GraduationHarness,
} from './fixtures/graduation.js';

async function studentAgent(
  harness: GraduationHarness,
  fixture: GraduationFixture,
) {
  const user = await harness.prisma.user.findUniqueOrThrow({
    where: { id: fixture.studentUserId },
  });
  return loginAgent(harness.app, {
    id: user.id,
    username: user.username,
    password: `${user.username}Pass1`,
  });
}

describe('student portal (F-20)', () => {
  const harness = graduationHarness();

  it('names the signed-in student and their applied program, without a student id in the URL (US-092 AC1/3)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const own = await studentAgent(harness, fixture);
    const me = await own
      .get('/api/portal/me')
      .query({ semesterId: fixture.semesterId })
      .expect(200);
    expect(me.headers['cache-control']).toContain('no-store');
    expect(me.body.student).toMatchObject({ id: fixture.studentId });
    expect(me.body.semester).toEqual({
      id: fixture.semesterId,
      semesterCode: fixture.world.laterSemesterCode,
    });
    expect(me.body.programs).toEqual([
      expect.objectContaining({
        programId: fixture.programId,
        enrollmentType: 'PRIMARY',
        versionId: fixture.versionId,
      }),
    ]);
  });

  it('shows the whole frame with four course states and the supplied marks (US-093 AC1/3)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const own = await studentAgent(harness, fixture);
    const query = graduationQuery(fixture);
    const empty = await own
      .get('/api/portal/curriculum')
      .query(query)
      .expect(200);
    const states = (body: {
      terms: { courses: { itemId: string; state: string }[] }[];
    }) =>
      new Map(
        body.terms
          .flatMap((term) => term.courses)
          .map((c) => [c.itemId, c.state]),
      );
    expect(
      [...states(empty.body).values()].every((s) => s === 'NOT_TAKEN'),
    ).toBe(true);
    expect(states(empty.body).size).toBe(4);

    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.mandatory,
      'PASSED',
      { score4: '3.5' },
    );
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.electiveA,
      'FAILED',
      { score4: '0.5' },
    );
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.electiveB,
      'IN_PROGRESS',
      { score4: null },
    );
    const before = await graduationWriteCounts(harness.prisma);
    const after = await own
      .get('/api/portal/curriculum')
      .query(query)
      .expect(200);
    expect(await graduationWriteCounts(harness.prisma)).toEqual(before);
    const read = states(after.body);
    expect(read.get(fixture.itemIds.mandatory)).toBe('PASSED');
    expect(read.get(fixture.itemIds.electiveA)).toBe('FAILED');
    expect(read.get(fixture.itemIds.electiveB)).toBe('IN_PROGRESS');
    expect(read.get(fixture.itemIds.conditional)).toBe('NOT_TAKEN');
    const mandatory = after.body.terms
      .flatMap((term: { courses: unknown[] }) => term.courses)
      .find(
        (course: { itemId: string }) =>
          course.itemId === fixture.itemIds.mandatory,
      );
    expect(mandatory).toMatchObject({ score4: '3.5', attemptCount: 1 });
  });

  it('agrees with the shared eligibility and graduation readers for the same student (US-094 AC4)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.mandatory,
      'PASSED',
    );
    const own = await studentAgent(harness, fixture);
    const query = graduationQuery(fixture);
    const portal = await own
      .get('/api/portal/curriculum')
      .query(query)
      .expect(200);
    const eligibility = await harness.office
      .get(`/api/students/${fixture.studentId}/registration-eligibility`)
      .query(query)
      .expect(200);
    const completed = new Set(
      eligibility.body.items
        .filter((item: { completed: boolean }) => item.completed)
        .map((item: { itemId: string }) => item.itemId),
    );
    const passed = new Set(
      portal.body.terms
        .flatMap(
          (term: { courses: { itemId: string; state: string }[] }) =>
            term.courses,
        )
        .filter((course: { state: string }) =>
          course.state.startsWith('PASSED'),
        )
        .map((course: { itemId: string }) => course.itemId),
    );
    expect(passed).toEqual(completed);
    const ownGraduation = await own
      .get(`/api/students/${fixture.studentId}/graduation`)
      .query(query)
      .expect(200);
    const staffGraduation = await harness.office
      .get(`/api/students/${fixture.studentId}/graduation`)
      .query(query)
      .expect(200);
    expect(ownGraduation.body.result.credits).toEqual(
      staffGraduation.body.result.credits,
    );
  });

  it('never reaches another student or a staff program read (US-092 AC2/5)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const own = await studentAgent(harness, fixture);
    const query = graduationQuery(fixture);
    await own
      .get(`/api/students/${fixture.secondStudentId}/results`)
      .query(query)
      .expect(404);
    await own
      .get(`/api/students/${fixture.secondStudentId}/registration-eligibility`)
      .query(query)
      .expect(404);
    // Enrolment no longer opens staff-addressed program, version or outcome reads.
    for (const path of [
      `/api/programs/${fixture.programId}`,
      `/api/program-versions/${fixture.versionId}/curriculum`,
      `/api/program-versions/${fixture.versionId}/plos`,
    ]) {
      const response = await own.get(path);
      expect({ path, status: response.status }).toEqual({ path, status: expect.toBeOneOf([403, 404]) });
    }
    await own.get('/api/portal/plos').query(query).expect(200);
    // A curriculum row of a version that is not the student's applied one is refused.
    await own
      .get('/api/portal/curriculum-items/not-a-row/syllabus')
      .query(query)
      .expect(404);
  });

  it('gives an account with no student record an actionable empty state (US-092 AC4)', async () => {
    const office = await harness.office.get('/api/portal/me').expect(200);
    expect(office.body).toEqual({
      student: null,
      semester: null,
      programs: [],
    });
    const lecturer = await loginAgent(
      harness.app,
      await createAccount(harness.app, 'portallecturer', 'R5', {
        unitCode: 'KHOA_CNTT',
      }),
    );
    await lecturer.get('/api/portal/me').expect(403);
  });

  it('refuses a syllabus that the row was not released with (US-096 AC1/2)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const own = await studentAgent(harness, fixture);
    const query = graduationQuery(fixture);
    const pinned = await harness.prisma.curriculumItem.findUniqueOrThrow({
      where: { id: fixture.itemIds.mandatory },
      select: { syllabusId: true },
    });
    const response = await own
      .get(`/api/portal/curriculum-items/${fixture.itemIds.mandatory}/syllabus`)
      .query(query);
    if (pinned.syllabusId) {
      expect(response.status).toBe(200);
      expect(Object.keys(response.body)).not.toContain('status');
      expect(Object.keys(response.body)).not.toContain('sourceRequestId');
    } else {
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('PORTAL_SYLLABUS_NOT_ISSUED');
    }
  });
});
