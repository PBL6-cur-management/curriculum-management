import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import {
  ImportBatchStatus,
  ImportType,
} from '../src/generated/prisma/client.js';
import type { ImportBatchDetailDto } from '../src/features/imports/dto/import-response.dto.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { STUDENT_LIMITS } from '../src/shared/students/student.constants.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from './containers.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { createCourse } from './fixtures/courses.js';
import {
  createStudentWorld,
  downloadBinary,
  readCredentialWorkbook,
  resultRow,
  resultWorkbook,
  studentRow,
  studentWorkbook,
  type StudentWorld,
  type SyntheticResultRow,
  type SyntheticStudentRow,
} from './fixtures/students.js';
import { waitForBatch } from './support/xlsx-builder.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const SETTLED = [ImportBatchStatus.COMMITTED, ImportBatchStatus.ABORTED];
const PERFORMANCE_TIMEOUT_MS = STUDENT_LIMITS.PERFORMANCE_BUDGET_MS * 4;
type Agent = ReturnType<typeof request.agent>;

describe('Student list and academic result imports with the real worker', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let otherAdmin: Agent;
  let world: StudentWorld;
  let counter = 0;
  const code = (prefix: string) =>
    `${prefix}${String(++counter).padStart(4, '0')}`;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    admin = await loginAgent(app, await createAccount(app, 'stuimp', 'R1'));
    otherAdmin = await loginAgent(
      app,
      await createAccount(app, 'stuother', 'R1'),
    );
    world = await createStudentWorld(app, admin, 'IMP');
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  function upload(
    importType: ImportType,
    bytes: Uint8Array,
    agent: Agent = admin,
  ) {
    return agent
      .post('/api/imports')
      .set(CSRF)
      .field('importType', importType)
      .attach('file', Buffer.from(bytes), 'sinh-vien.xlsx');
  }

  async function dryRun(
    importType: ImportType,
    bytes: Uint8Array,
    agent: Agent = admin,
  ) {
    const response = await upload(importType, bytes, agent).expect(201);
    return waitForBatch(agent, response.body.id);
  }

  async function commit(batch: ImportBatchDetailDto, agent: Agent = admin) {
    await agent.post(`/api/imports/${batch.id}/commit`).set(CSRF).expect(202);
    return waitForBatch(agent, batch.id, SETTLED);
  }

  const importStudents = async (rows: SyntheticStudentRow[]) =>
    commit(await dryRun(ImportType.STUDENT_LIST, await studentWorkbook(rows)));
  const importResults = async (rows: SyntheticResultRow[]) =>
    commit(
      await dryRun(ImportType.ACADEMIC_RESULT, await resultWorkbook(rows)),
    );

  async function downloadCredentials(batchId: string, agent: Agent = admin) {
    return downloadBinary(
      agent
        .post(`/api/imports/${batchId}/student-credentials/download`)
        .set(CSRF),
    );
  }

  async function writeCounts() {
    const [students, users, enrollments, results, deliveries] =
      await Promise.all([
        prisma.student.count(),
        prisma.user.count(),
        prisma.programEnrollment.count(),
        prisma.academicResult.count(),
        prisma.studentCredentialDelivery.count(),
      ]);
    return { students, users, enrollments, results, deliveries };
  }

  describe('templates and dry run', () => {
    it.each([ImportType.STUDENT_LIST, ImportType.ACADEMIC_RESULT])(
      'serves the %s template to the office',
      async (importType) => {
        const response = await admin
          .get(`/api/imports/templates/${importType}`)
          .expect(200);
        expect(response.headers['content-type']).toContain('spreadsheetml');
      },
    );

    it('writes only the batch and its file on a dry run', async () => {
      const before = await writeCounts();
      const batch = await dryRun(
        ImportType.STUDENT_LIST,
        await studentWorkbook([
          studentRow(world, code('DRY')),
          studentRow(world, code('DRY')),
        ]),
      );
      expect(batch.status).toBe(ImportBatchStatus.DRY_RUN);
      expect(batch.errorRows).toBe(0);
      expect(batch.canCommit).toBe(true);
      expect(await writeCounts()).toEqual(before);
    });

    it('reports a repeated student code as an error and refuses to commit', async () => {
      const repeated = code('DUP');
      const batch = await dryRun(
        ImportType.STUDENT_LIST,
        await studentWorkbook([
          studentRow(world, repeated),
          studentRow(world, repeated),
        ]),
      );
      expect(batch.canCommit).toBe(false);
      expect(
        batch.report!.issues.some(
          (issue) =>
            issue.severity === 'ERROR' &&
            issue.code === 'DUPLICATE_CODE_IN_FILE',
        ),
      ).toBe(true);
      const refused = await admin
        .post(`/api/imports/${batch.id}/commit`)
        .set(CSRF);
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('IMPORT_HAS_ERRORS');
    });

    it('reports unknown references as errors', async () => {
      const batch = await dryRun(
        ImportType.STUDENT_LIST,
        await studentWorkbook([
          studentRow(world, code('REF'), {
            cohortCode: 'NOPE',
            programCode: 'NOPE',
            admissionSemesterCode: 'NOPE',
          }),
        ]),
      );
      const codes = batch
        .report!.issues.filter((issue) => issue.severity === 'ERROR')
        .map((issue) => issue.code);
      expect(codes).toContain('REFERENCE_UNKNOWN');
      expect(batch.canCommit).toBe(false);
    });

    it('rejects unknown results references and unknown courses', async () => {
      const batch = await dryRun(
        ImportType.ACADEMIC_RESULT,
        await resultWorkbook([
          resultRow(world, 'NOSUCH01', { courseCode: 'NOCOURSE' }),
        ]),
      );
      expect(batch.canCommit).toBe(false);
      expect(
        batch.report!.issues.some(
          (issue) => issue.code === 'REFERENCE_UNKNOWN',
        ),
      ).toBe(true);
    });
  });

  describe('student commit and credentials', () => {
    it('creates one account, one role, one enrollment and one sealed delivery per new student', async () => {
      const codes = [code('NEW'), code('NEW')];
      const before = await writeCounts();
      const batch = await importStudents(
        codes.map((studentCode) => studentRow(world, studentCode)),
      );
      expect(batch.status).toBe(ImportBatchStatus.COMMITTED);

      const after = await writeCounts();
      expect(after.students - before.students).toBe(2);
      expect(after.users - before.users).toBe(2);
      expect(after.enrollments - before.enrollments).toBe(2);
      expect(after.deliveries - before.deliveries).toBe(1);

      const students = await prisma.student.findMany({
        where: { studentCode: { in: codes } },
        include: {
          user: { include: { roleAssignments: { include: { role: true } } } },
          enrollments: true,
        },
      });
      for (const student of students) {
        expect(student.dataSource).toBe('EXCEL');
        expect(student.user!.username).toBe(student.studentCode.toLowerCase());
        expect(student.user!.mustChangePassword).toBe(true);
        expect(
          student.user!.roleAssignments.map((a) => a.role.roleCode),
        ).toEqual(['R6']);
        expect(student.enrollments).toHaveLength(1);
        expect(student.enrollments[0]!.appliedVersionId).toBe(world.versionId);
      }

      const delivery = await prisma.studentCredentialDelivery.findUniqueOrThrow(
        {
          where: { batchId: batch.id },
        },
      );
      expect(delivery.accountCount).toBe(2);
      expect(delivery.ciphertext).not.toBeNull();
      // The stored payload is the sealed workbook, never the plain xlsx zip.
      expect(delivery.ciphertext!.subarray(0, 2).toString()).not.toBe('PK');
    });

    it('creates the profile and account with a HIGH warning when the cohort has no assignment', async () => {
      const unassigned = await prisma.cohort.create({
        data: { cohortCode: code('NOASSIGN'), intakeYear: 2026 },
      });
      const studentCode = code('WARN');
      const batch = await dryRun(
        ImportType.STUDENT_LIST,
        await studentWorkbook([
          studentRow(world, studentCode, { cohortCode: unassigned.cohortCode }),
        ]),
      );
      const warning = batch.report!.issues.find(
        (issue) => issue.code === 'PROGRAM_UNRESOLVED',
      );
      expect(warning?.severity).toBe('HIGH');
      expect(batch.canCommit).toBe(true);

      expect((await commit(batch)).status).toBe(ImportBatchStatus.COMMITTED);
      const student = await prisma.student.findUniqueOrThrow({
        where: { studentCode },
        include: { enrollments: true },
      });
      expect(student.userId).not.toBeNull();
      expect(student.enrollments).toHaveLength(0);
    });

    it('lets only the importer read the status and download the file once', async () => {
      const studentCode = code('CRED');
      const batch = await importStudents([studentRow(world, studentCode)]);

      const status = await admin
        .get(`/api/imports/${batch.id}/student-credentials`)
        .expect(200);
      expect(status.body).toMatchObject({
        available: true,
        accountCount: 1,
        downloadedAt: null,
      });
      await otherAdmin
        .get(`/api/imports/${batch.id}/student-credentials`)
        .expect(404);
      expect((await downloadCredentials(batch.id, otherAdmin)).status).toBe(
        404,
      );

      const first = await downloadCredentials(batch.id);
      expect(first.status).toBe(200);
      expect(first.headers['content-type']).toContain('spreadsheetml');
      const rows = await readCredentialWorkbook(first.body);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        studentCode,
        username: studentCode.toLowerCase(),
      });

      const second = await admin
        .post(`/api/imports/${batch.id}/student-credentials/download`)
        .set(CSRF);
      expect(second.status).toBe(410);
      expect(second.body.code).toBe('CREDENTIALS_ALREADY_DOWNLOADED');

      const after = await admin
        .get(`/api/imports/${batch.id}/student-credentials`)
        .expect(200);
      expect(after.body.available).toBe(false);
      expect(after.body.downloadedAt).not.toBeNull();
      const stored = await prisma.studentCredentialDelivery.findUniqueOrThrow({
        where: { batchId: batch.id },
      });
      expect(stored.ciphertext).toBeNull();
    });

    it('refuses an expired delivery', async () => {
      const batch = await importStudents([studentRow(world, code('EXP'))]);
      await prisma.studentCredentialDelivery.update({
        where: { batchId: batch.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const response = await admin
        .post(`/api/imports/${batch.id}/student-credentials/download`)
        .set(CSRF);
      expect(response.status).toBe(410);
      expect(response.body.code).toBe('CREDENTIALS_EXPIRED');
    });

    it('reports tampered ciphertext as unreadable and keeps the file', async () => {
      const batch = await importStudents([studentRow(world, code('TAMP'))]);
      const stored = await prisma.studentCredentialDelivery.findUniqueOrThrow({
        where: { batchId: batch.id },
      });
      const tampered = Buffer.from(stored.ciphertext!);
      tampered[0] = tampered[0]! ^ 0xff;
      await prisma.studentCredentialDelivery.update({
        where: { batchId: batch.id },
        data: { ciphertext: tampered },
      });
      const response = await admin
        .post(`/api/imports/${batch.id}/student-credentials/download`)
        .set(CSRF);
      expect(response.status).toBe(503);
      expect(response.body.code).toBe('CREDENTIALS_UNREADABLE');
      const after = await prisma.studentCredentialDelivery.findUniqueOrThrow({
        where: { batchId: batch.id },
      });
      expect(after.downloadedAt).toBeNull();
      expect(after.ciphertext).not.toBeNull();
    });

    it('refuses a student upload and a download when the key is not configured', async () => {
      const batch = await importStudents([studentRow(world, code('KEY'))]);
      const config = app.get(ConfigService);
      const original = config.get.bind(config);
      const spy = vi
        .spyOn(config, 'get')
        .mockImplementation(((name: string, ...rest: unknown[]) =>
          name === 'STUDENT_CREDENTIAL_ENCRYPTION_KEY'
            ? undefined
            : (original as (...args: unknown[]) => unknown)(
                name,
                ...rest,
              )) as never);
      try {
        const download = await admin
          .post(`/api/imports/${batch.id}/student-credentials/download`)
          .set(CSRF);
        expect(download.status).toBe(503);
        expect(download.body.code).toBe('STUDENT_CREDENTIALS_UNAVAILABLE');

        const before = await prisma.importBatch.count();
        const upload503 = await upload(
          ImportType.STUDENT_LIST,
          await studentWorkbook([studentRow(world, code('KEY'))]),
        );
        expect(upload503.status).toBe(503);
        expect(upload503.body.code).toBe('STUDENT_CREDENTIALS_UNAVAILABLE');
        expect(await prisma.importBatch.count()).toBe(before);
      } finally {
        spy.mockRestore();
      }
    });

    it('forces the new student to change the temporary password before anything else', async () => {
      const studentCode = code('LOGIN');
      const batch = await importStudents([studentRow(world, studentCode)]);
      const [credential] = await readCredentialWorkbook(
        (await downloadCredentials(batch.id)).body,
      );
      const student = request.agent(app.getHttpServer());
      await student
        .post('/api/auth/login')
        .set(CSRF)
        .send({
          username: credential!.username,
          password: credential!.password,
        })
        .expect(200);
      const blocked = await student.get('/api/students/any').query({
        semesterId: world.admissionSemesterId,
      });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

      await student
        .post('/api/auth/change-password')
        .set(CSRF)
        .send({
          currentPassword: credential!.password,
          newPassword: 'NewPassw0rd!x',
        })
        .expect(204);
      const own = await prisma.student.findUniqueOrThrow({
        where: { studentCode },
      });
      const allowed = await student
        .get(`/api/students/${own.id}/results`)
        .query({
          semesterId: world.admissionSemesterId,
          programId: world.programId,
        });
      expect(allowed.status).toBe(200);
      expect(allowed.body.total).toBe(0);
    });

    it('updates an Excel profile without touching the account or the pinned enrollment', async () => {
      const studentCode = code('UPD');
      await importStudents([studentRow(world, studentCode)]);
      const before = await prisma.student.findUniqueOrThrow({
        where: { studentCode },
        include: { enrollments: true, user: true },
      });
      const batch = await importStudents([
        studentRow(world, studentCode, {
          fullName: 'Tên đã đổi',
          status: 'Bảo lưu',
          statusSemesterCode: world.laterSemesterCode,
        }),
      ]);
      expect(batch.status).toBe(ImportBatchStatus.COMMITTED);
      const after = await prisma.student.findUniqueOrThrow({
        where: { studentCode },
        include: { enrollments: true, user: true },
      });
      expect(after.fullName).toBe('Tên đã đổi');
      expect(after.status).toBe('ON_LEAVE');
      expect(after.userId).toBe(before.userId);
      expect(after.user!.passwordHash).toBe(before.user!.passwordHash);
      expect(after.enrollments.map((e) => e.id)).toEqual(
        before.enrollments.map((e) => e.id),
      );
      expect(
        await prisma.studentCredentialDelivery.count({
          where: { batchId: batch.id },
        }),
      ).toBe(0);
    });

    it('keeps a student that came from the school database and warns', async () => {
      const studentCode = code('SCH');
      await importStudents([studentRow(world, studentCode)]);
      await prisma.student.update({
        where: { studentCode },
        data: { dataSource: 'SCHOOL_DB' },
      });
      const batch = await dryRun(
        ImportType.STUDENT_LIST,
        await studentWorkbook([
          studentRow(world, studentCode, { fullName: 'Không được ghi đè' }),
        ]),
      );
      const warning = batch.report!.issues.find(
        (issue) => issue.code === 'SCHOOL_DB_PRESERVED',
      );
      expect(warning?.severity).toBe('HIGH');
      await commit(batch);
      const kept = await prisma.student.findUniqueOrThrow({
        where: { studentCode },
      });
      expect(kept.fullName).not.toBe('Không được ghi đè');
    });

    it('writes nothing when the data changed to have an error after the dry run', async () => {
      const studentCode = code('RACE');
      const batch = await dryRun(
        ImportType.STUDENT_LIST,
        await studentWorkbook([studentRow(world, studentCode)]),
      );
      expect(batch.canCommit).toBe(true);
      await createAccount(app, studentCode.toLowerCase());
      const before = await writeCounts();

      const settled = await commit(batch);
      expect(settled.status).toBe(ImportBatchStatus.ABORTED);
      expect(await writeCounts()).toEqual(before);
      expect(await prisma.student.count({ where: { studentCode } })).toBe(0);
    });

    it('aborts without writes when the importer lost the import grant before commit', async () => {
      const revoked = await createAccount(app, 'sturevoked', 'R1');
      const agent = await loginAgent(app, revoked);
      const batch = await dryRun(
        ImportType.STUDENT_LIST,
        await studentWorkbook([studentRow(world, code('REV'))]),
        agent,
      );
      await prisma.roleAssignment.deleteMany({ where: { userId: revoked.id } });
      const before = await writeCounts();
      const response = await agent
        .post(`/api/imports/${batch.id}/commit`)
        .set(CSRF);
      if (response.status === 202) {
        const settled = await waitForBatch(agent, batch.id, SETTLED);
        expect(settled.status).toBe(ImportBatchStatus.ABORTED);
      } else {
        expect([401, 403]).toContain(response.status);
      }
      expect(await writeCounts()).toEqual(before);
    });
  });

  describe('academic results', () => {
    it('stores the four statuses and allows a retake in another semester', async () => {
      const studentCode = code('RES');
      await importStudents([studentRow(world, studentCode)]);
      const second = await createCourse(app, { courseCode: code('RC') });
      const third = await createCourse(app, { courseCode: code('RC') });
      const fourth = await createCourse(app, { courseCode: code('RC') });
      const batch = await importResults([
        resultRow(world, studentCode),
        resultRow(world, studentCode, {
          courseCode: second.courseCode,
          score10: '3.00',
          score4: '0.00',
          letterGrade: 'F',
          status: 'Không đạt',
        }),
        resultRow(world, studentCode, {
          courseCode: third.courseCode,
          score10: '',
          score4: '',
          letterGrade: '',
          status: 'Đang học',
        }),
        resultRow(world, studentCode, {
          courseCode: fourth.courseCode,
          score10: '',
          score4: '',
          letterGrade: '',
          status: 'Miễn',
        }),
        resultRow(world, studentCode, {
          courseCode: second.courseCode,
          semesterCode: world.laterSemesterCode,
          score10: '7.00',
          score4: '3.00',
          letterGrade: 'B',
        }),
      ]);
      expect(batch.status).toBe(ImportBatchStatus.COMMITTED);
      const stored = await prisma.academicResult.findMany({
        where: { student: { studentCode } },
      });
      expect(stored).toHaveLength(5);
      expect(new Set(stored.map((r) => r.status))).toEqual(
        new Set(['PASSED', 'FAILED', 'IN_PROGRESS', 'EXEMPT']),
      );
      expect(stored.every((r) => r.revision === 1)).toBe(true);
    });

    it('revises a result on the same triple and records before and after', async () => {
      const studentCode = code('REV');
      await importStudents([studentRow(world, studentCode)]);
      await importResults([resultRow(world, studentCode)]);
      await importResults([
        resultRow(world, studentCode, {
          score10: '9.00',
          score4: '4.00',
          letterGrade: 'A',
        }),
      ]);
      const result = await prisma.academicResult.findFirstOrThrow({
        where: { student: { studentCode } },
      });
      expect(result.revision).toBe(2);
      expect(result.score10?.toString()).toBe('9');
      const changes = await prisma.academicResultChange.findMany({
        where: { academicResultId: result.id },
      });
      expect(changes.length).toBeGreaterThanOrEqual(1);
      const last = changes[changes.length - 1]!;
      expect(JSON.stringify(last)).toContain('8.5');
      expect(JSON.stringify(last)).toContain('9');
    });

    it('creates no revision when the same results are imported again', async () => {
      const studentCode = code('SAME');
      await importStudents([studentRow(world, studentCode)]);
      await importResults([resultRow(world, studentCode)]);
      const before = await prisma.academicResultChange.count();
      const batch = await importResults([resultRow(world, studentCode)]);
      expect(batch.status).toBe(ImportBatchStatus.COMMITTED);
      const result = await prisma.academicResult.findFirstOrThrow({
        where: { student: { studentCode } },
      });
      expect(result.revision).toBe(1);
      expect(await prisma.academicResultChange.count()).toBe(before);
    });
  });

  describe('access', () => {
    it('refuses an anonymous caller', async () => {
      await request(app.getHttpServer())
        .post('/api/imports')
        .set(CSRF)
        .field('importType', ImportType.STUDENT_LIST)
        .attach('file', Buffer.from('x'), 'a.xlsx')
        .expect(401);
    });

    it.each([
      ['R2', 'stur2', 'KHOA_CNTT'],
      ['R3', 'stur3', 'KHOA_CNTT'],
      ['R4', 'stur4', 'KHOA_CNTT'],
      ['R5', 'stur5', 'PDT'],
    ])('refuses %s an upload and writes nothing', async (role, name, unit) => {
      const agent = await loginAgent(
        app,
        await createAccount(app, name, role, { unitCode: unit }),
      );
      const before = await prisma.importBatch.count();
      const response = await upload(
        ImportType.STUDENT_LIST,
        await studentWorkbook([studentRow(world, code('DENY'))]),
        agent,
      );
      expect(response.status).toBe(403);
      expect(await prisma.importBatch.count()).toBe(before);
    });
  });

  describe('NFR-05 volume', () => {
    // Measured from the accepted upload request to the terminal state of the batch; hardware and concurrency are recorded in the implement report.
    it(
      `imports ${STUDENT_LIMITS.PERFORMANCE_ROWS} students with password hashes and ${STUDENT_LIMITS.PERFORMANCE_ROWS} results inside the budget`,
      async () => {
        const rows = Array.from(
          { length: STUDENT_LIMITS.PERFORMANCE_ROWS },
          (_, index) =>
            studentRow(world, `PERF${String(index).padStart(5, '0')}`),
        );
        const studentFile = await studentWorkbook(rows);

        const studentDryStart = performance.now();
        const studentDry = await (async () => {
          const response = await upload(
            ImportType.STUDENT_LIST,
            studentFile,
          ).expect(201);
          return waitForBatch(
            admin,
            response.body.id,
            undefined,
            PERFORMANCE_TIMEOUT_MS,
          );
        })();
        const studentDryMs = performance.now() - studentDryStart;
        expect(studentDry.errorRows).toBe(0);

        const studentCommitStart = performance.now();
        await admin
          .post(`/api/imports/${studentDry.id}/commit`)
          .set(CSRF)
          .expect(202);
        const studentDone = await waitForBatch(
          admin,
          studentDry.id,
          SETTLED,
          PERFORMANCE_TIMEOUT_MS,
        );
        const studentCommitMs = performance.now() - studentCommitStart;
        expect(studentDone.status).toBe(ImportBatchStatus.COMMITTED);
        expect(
          await prisma.student.count({
            where: { studentCode: { startsWith: 'PERF' } },
          }),
        ).toBe(STUDENT_LIMITS.PERFORMANCE_ROWS);

        const resultFile = await resultWorkbook(
          rows.map((row) => resultRow(world, row.studentCode!)),
        );
        const resultDryStart = performance.now();
        const resultUpload = await upload(
          ImportType.ACADEMIC_RESULT,
          resultFile,
        ).expect(201);
        const resultDry = await waitForBatch(
          admin,
          resultUpload.body.id,
          undefined,
          PERFORMANCE_TIMEOUT_MS,
        );
        const resultDryMs = performance.now() - resultDryStart;
        expect(resultDry.errorRows).toBe(0);

        const resultCommitStart = performance.now();
        await admin
          .post(`/api/imports/${resultDry.id}/commit`)
          .set(CSRF)
          .expect(202);
        const resultDone = await waitForBatch(
          admin,
          resultDry.id,
          SETTLED,
          PERFORMANCE_TIMEOUT_MS,
        );
        const resultCommitMs = performance.now() - resultCommitStart;
        expect(resultDone.status).toBe(ImportBatchStatus.COMMITTED);

        console.info(
          `NFR-05 students dry-run ${Math.round(studentDryMs)} ms, commit ${Math.round(studentCommitMs)} ms; results dry-run ${Math.round(resultDryMs)} ms, commit ${Math.round(resultCommitMs)} ms`,
        );
        for (const elapsed of [
          studentDryMs,
          studentCommitMs,
          resultDryMs,
          resultCommitMs,
        ]) {
          expect(elapsed).toBeLessThan(STUDENT_LIMITS.PERFORMANCE_BUDGET_MS);
        }
      },
      PERFORMANCE_TIMEOUT_MS * 3,
    );
  });
});
