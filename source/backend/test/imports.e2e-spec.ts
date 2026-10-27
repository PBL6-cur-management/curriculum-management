import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import {
  CourseStatus,
  ImportBatchStatus,
  ImportType,
} from '../src/generated/prisma/client.js';
import type { ImportBatchDetailDto } from '../src/features/imports/dto/import-response.dto.js';
import { IMPORT_JOB } from '../src/features/imports/import.constants.js';
import { ImportsProcessor } from '../src/features/imports/imports.processor.js';
import { CURRICULUM_SHEET } from '../src/features/imports/sheets/curriculum.sheet.js';
import { readSheet } from '../src/features/imports/sheets/sheet-reader.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from './containers.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { createCourse } from './fixtures/courses.js';
import { addCurriculumItem } from './fixtures/curriculum.js';
import { assignDirector, createProgram } from './fixtures/programs.js';
import {
  createClo,
  createPlo,
  putLinks,
  setPloWeight,
} from './fixtures/outcomes.js';
import { releaseViaApi } from './fixtures/releases.js';
import { createSyllabusDraft } from './fixtures/syllabi.js';
import {
  catalogXlsx,
  curriculumXlsx,
  IMPORT_E2E_BUDGET_MS,
  waitForBatch,
} from './support/xlsx-builder.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
type Agent = ReturnType<typeof request.agent>;
const catalogRow = (courseCode: string, credits = '3') => ({
  courseCode,
  courseName: `Học phần ${courseCode}`,
  credits,
  courseType: 'Lý thuyết',
});

describe('Excel imports and curriculum export with the real worker', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let otherAdmin: Agent;
  let director: Agent;
  let denied: Agent;
  let directorId: string;
  let counter = 0;
  const unique = (prefix: string) => `${prefix}${++counter}`;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    admin = await loginAgent(app, await createAccount(app, 'impadmin', 'R1'));
    otherAdmin = await loginAgent(
      app,
      await createAccount(app, 'impother', 'R1'),
    );
    const account = await createAccount(app, 'impdirector');
    directorId = account.id;
    director = await loginAgent(app, account);
    denied = await loginAgent(
      app,
      await createAccount(app, 'impdenied', 'R4', { unitCode: 'KHOA_CNTT' }),
    );
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  async function draft() {
    const program = await createProgram(app, { programCode: unique('IMP') });
    return { program, versionId: program.versions[0].id };
  }

  function upload(bytes: Buffer, versionId?: string, agent = admin) {
    const call = agent
      .post('/api/imports')
      .set(CSRF)
      .field(
        'importType',
        versionId ? ImportType.CURRICULUM : ImportType.COURSE_CATALOG,
      );
    if (versionId) call.field('versionId', versionId);
    return call.attach('file', bytes, 'khung.xlsx');
  }

  async function dryRun(bytes: Buffer, versionId?: string, agent = admin) {
    const response = await upload(bytes, versionId, agent).expect(201);
    return waitForBatch(agent, response.body.id);
  }

  async function commit(batch: ImportBatchDetailDto, agent = admin) {
    await agent.post(`/api/imports/${batch.id}/commit`).set(CSRF).expect(202);
    return waitForBatch(agent, batch.id, [
      ImportBatchStatus.COMMITTED,
      ImportBatchStatus.ABORTED,
    ]);
  }

  async function seedCourses(count: number) {
    const faculty = await prisma.orgUnit.findUniqueOrThrow({
      where: { unitCode: 'KHOA_CNTT' },
    });
    const prefix = unique('IX');
    const codes = Array.from(
      { length: count },
      (_, index) => `${prefix}${String(index).padStart(4, '0')}`,
    );
    await prisma.course.createMany({
      data: codes.map((courseCode) => ({
        courseCode,
        courseName: `Học phần ${courseCode}`,
        credits: '3',
        courseType: 'THEORY',
        ownerFacultyId: faculty.id,
      })),
    });
    return codes;
  }

  it('rejects a missing semester column synchronously and rejects an empty template', async () => {
    const { versionId } = await draft();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(
        await curriculumXlsx({}, [
          { courseCode: 'UNKNOWN', plannedSemester: '1' },
        ]),
      ).buffer,
    );
    workbook.worksheets[0].spliceColumns(6, 1);
    const response = await upload(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      versionId,
    ).expect(201);
    expect(response.body.status).toBe(ImportBatchStatus.ABORTED);
    expect(response.body.report.formatErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ column: 'Học kỳ' })]),
    );
    const template = await dryRun(
      await downloadBytes('/api/imports/templates/CURRICULUM'),
      versionId,
    );
    expect(template.status).toBe(ImportBatchStatus.ABORTED);
    expect(template.report?.formatErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'Tệp không có dòng dữ liệu.' }),
      ]),
    );
    expect(await prisma.curriculumItem.count({ where: { versionId } })).toBe(0);
  });

  it('preserves worksheet row 15 in unknown-course errors and blocks commit', async () => {
    const { versionId } = await draft();
    const batch = await dryRun(
      await curriculumXlsx({}, [
        ...Array.from({ length: 5 }, () => ({})),
        { courseCode: 'UNKNOWN', plannedSemester: '1' },
      ]),
      versionId,
    );
    expect(batch.status).toBe(ImportBatchStatus.ABORTED);
    expect(batch.report?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 15,
          code: 'COURSE_UNKNOWN',
          severity: 'ERROR',
        }),
      ]),
    );
    expect(batch.canCommit).toBe(false);
    await admin.post(`/api/imports/${batch.id}/commit`).set(CSRF).expect(409);
    expect(await prisma.curriculumItem.count({ where: { versionId } })).toBe(0);
  });

  it('reports every duplicate catalog row, then writes fractional and zero credits', async () => {
    const code = unique('CAT');
    const zero = unique('ZERO');
    const duplicate = await dryRun(
      await catalogXlsx([
        catalogRow(code, '2.5'),
        catalogRow(code),
        catalogRow(zero, '0'),
      ]),
    );
    expect(duplicate.status).toBe(ImportBatchStatus.ABORTED);
    expect(
      duplicate.report?.issues
        .filter((issue) => issue.code === 'DUPLICATE_CODE_IN_FILE')
        .map((issue) => issue.rowNumber),
    ).toEqual([2, 3]);
    const clean = await dryRun(
      await catalogXlsx([catalogRow(code, '2.5'), catalogRow(zero, '0')]),
    );
    expect(clean.status).toBe(ImportBatchStatus.DRY_RUN);
    expect(
      await prisma.course.count({
        where: { courseCode: { in: [code, zero] } },
      }),
    ).toBe(0);
    expect(clean.report?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ZERO_CREDITS', severity: 'HIGH' }),
      ]),
    );
    expect((await commit(clean)).status).toBe(ImportBatchStatus.COMMITTED);
    expect(
      (
        await prisma.course.findUniqueOrThrow({ where: { courseCode: code } })
      ).credits.toString(),
    ).toBe('2.5');
  });
  it('commits 30 rows in file order within each semester', async () => {
    const { versionId } = await draft();
    const codes = await seedCourses(30);
    const batch = await dryRun(
      await curriculumXlsx(
        {},
        codes.map((courseCode, index) => ({
          courseCode,
          plannedSemester: String((index % 2) + 1),
        })),
      ),
      versionId,
    );
    expect(batch).toMatchObject({
      status: ImportBatchStatus.DRY_RUN,
      totalRows: 30,
      errorRows: 0,
    });
    expect((await commit(batch)).status).toBe(ImportBatchStatus.COMMITTED);
    const items = await prisma.curriculumItem.findMany({
      where: { versionId },
      orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }],
      include: { course: true },
    });
    expect(items.map((item) => item.course.courseCode)).toEqual([
      ...codes.filter((_, index) => index % 2 === 0),
      ...codes.filter((_, index) => index % 2 === 1),
    ]);
    const response = await admin
      .get(`/api/program-versions/${versionId}/curriculum`)
      .expect(200);
    expect(JSON.stringify(response.body)).toContain(codes[29]);
  });

  it('detects duplicate curriculum courses and cycles spanning catalog and file edges', async () => {
    const { versionId } = await draft();
    const first = await createCourse(app, { courseCode: unique('CYCLE') });
    const second = await createCourse(app, { courseCode: unique('CYCLE') });
    await prisma.courseRelation.create({
      data: {
        sourceCourseId: first.id,
        targetCourseId: second.id,
        relationType: 'PRIOR',
      },
    });
    const batch = await dryRun(
      await curriculumXlsx({}, [
        {
          courseCode: first.courseCode,
          plannedSemester: '1',
          priorCourses: second.courseCode,
        },
        { courseCode: second.courseCode, plannedSemester: '2' },
        { courseCode: second.courseCode, plannedSemester: '2' },
      ]),
      versionId,
    );
    expect(batch.status).toBe(ImportBatchStatus.ABORTED);
    expect(batch.report?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_COURSE', rowNumber: 12 }),
        expect.objectContaining({
          code: 'REQUISITE_CYCLE',
          message: expect.stringContaining('→'),
        }),
      ]),
    );
  });

  it('revalidates after the dry-run and aborts without partial curriculum writes', async () => {
    const { versionId } = await draft();
    const codes = await seedCourses(2);
    const batch = await dryRun(
      await curriculumXlsx(
        {},
        codes.map((courseCode) => ({ courseCode, plannedSemester: '1' })),
      ),
      versionId,
    );
    expect(batch.status).toBe(ImportBatchStatus.DRY_RUN);
    await prisma.course.update({
      where: { courseCode: codes[1] },
      data: { status: CourseStatus.CANCELLED },
    });
    const result = await commit(batch);
    expect(result.status).toBe(ImportBatchStatus.ABORTED);
    expect(result.report?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CHANGED_SINCE_DRY_RUN' }),
      ]),
    );
    expect(await prisma.curriculumItem.count({ where: { versionId } })).toBe(0);
  });

  it('writes a 2000-row catalog exactly once and rejects a second commit', async () => {
    const prefix = unique('BULK');
    const rows = Array.from({ length: 2000 }, (_, index) =>
      catalogRow(`${prefix}${index}`),
    );
    const batch = await dryRun(await catalogXlsx(rows));
    expect(batch).toMatchObject({
      status: ImportBatchStatus.DRY_RUN,
      totalRows: 2000,
      errorRows: 0,
    });
    expect((await commit(batch)).status).toBe(ImportBatchStatus.COMMITTED);
    const again = await admin
      .post(`/api/imports/${batch.id}/commit`)
      .set(CSRF)
      .expect(409);
    expect(again.body.code).toBe('IMPORT_NOT_COMMITTABLE');
    expect(
      await prisma.course.count({
        where: { courseCode: { in: rows.map((row) => row.courseCode) } },
      }),
    ).toBe(2000);
  });

  async function exportBytes(
    versionId: string,
    agent = admin,
  ): Promise<Buffer> {
    return downloadBytes(
      `/api/program-versions/${versionId}/curriculum/export`,
      agent,
    );
  }

  async function downloadBytes(path: string, agent = admin): Promise<Buffer> {
    const response = await agent
      .get(path)
      .buffer(true)
      .parse((stream, callback) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', callback);
        stream.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(response.headers['content-disposition']).toContain(
      "filename*=UTF-8''",
    );
    return response.body as Buffer;
  }

  it('round-trips exported rows into a copy and keeps existing item ids on reimport', async () => {
    const source = await draft();
    const copy = await draft();
    for (const versionId of [source.versionId, copy.versionId])
      await prisma.programVersion.update({
        where: { id: versionId },
        data: {
          totalCredits: '6',
          compulsoryCredits: '6',
          electiveCredits: '0',
        },
      });
    const first = await createCourse(app, { courseCode: unique('ROUND') });
    const second = await createCourse(app, { courseCode: unique('ROUND') });
    await addCurriculumItem(admin, source.versionId, {
      courseId: first.id,
      plannedSemester: 1,
      blockSymbol: 'CS',
    });
    const sourceSecond = await addCurriculumItem(admin, source.versionId, {
      courseId: second.id,
      plannedSemester: 2,
    });
    await prisma.curriculumItem.update({
      where: { id: sourceSecond.id },
      data: {
        htDa: true,
        tqDa: true,
        minStudiedScore: '4',
        minTransferScore: '2.5',
        note: 'Tiếng Việt',
      },
    });
    await prisma.curriculumRequisite.create({
      data: {
        itemId: sourceSecond.id,
        sourceCourseId: first.id,
        relationType: 'PRIOR',
      },
    });
    const original = await exportBytes(source.versionId);
    const parsed = await readSheet(original, CURRICULUM_SHEET);
    expect(parsed.rows.every((row) => row.cells.registrable === '')).toBe(true);
    expect(parsed.rows[1].cells.priorCourses).toContain(
      `${first.courseCode} – `,
    );
    const copyBytes = await curriculumXlsx(
      {
        ...parsed.header,
        programCode: copy.program.programCode,
        programName: copy.program.versions[0].programName,
      },
      parsed.rows.map((row) => row.cells),
    );
    const batch = await dryRun(copyBytes, copy.versionId);
    expect(batch.status, JSON.stringify(batch.report, null, 2)).toBe(
      ImportBatchStatus.DRY_RUN,
    );
    expect(
      batch.report?.issues.every((issue) => issue.severity === 'INFO'),
      JSON.stringify(batch.report, null, 2),
    ).toBe(true);
    expect((await commit(batch)).status).toBe(ImportBatchStatus.COMMITTED);
    const exportedCopy = await exportBytes(copy.versionId);
    expect(
      (await readSheet(exportedCopy, CURRICULUM_SHEET)).rows.map(
        (row) => row.cells,
      ),
    ).toEqual(parsed.rows.map((row) => row.cells));
    const keptIds = await prisma.curriculumItem.findMany({
      where: { versionId: copy.versionId },
      orderBy: { courseId: 'asc' },
      select: { id: true },
    });
    expect(
      (await commit(await dryRun(exportedCopy, copy.versionId))).status,
    ).toBe(ImportBatchStatus.COMMITTED);
    expect(
      await prisma.curriculumItem.findMany({
        where: { versionId: copy.versionId },
        orderBy: { courseId: 'asc' },
        select: { id: true },
      }),
    ).toEqual(keptIds);
  });

  it('reports removed rows and deletes them only on confirmation', async () => {
    const { versionId } = await draft();
    const codes = await seedCourses(2);
    const initial = await dryRun(
      await curriculumXlsx(
        {},
        codes.map((courseCode) => ({ courseCode, plannedSemester: '1' })),
      ),
      versionId,
    );
    expect((await commit(initial)).status).toBe(ImportBatchStatus.COMMITTED);
    const removed = await prisma.curriculumItem.findFirstOrThrow({
      where: { versionId, course: { courseCode: codes[1] } },
    });
    const plo = await createPlo(admin, versionId, 'PLO1');
    await setPloWeight(admin, removed.id, plo.id, '1');
    const syllabus = await createSyllabusDraft(admin, removed.courseId);
    const clo = await createClo(admin, syllabus.id, 'CLO1');
    await putLinks(admin, removed.id, [
      { cloId: clo.id, ploId: plo.id },
    ]).expect(200);
    expect(
      await prisma.cLOPLOMapping.count({
        where: { curriculumItemId: removed.id },
      }),
    ).toBe(1);
    const batch = await dryRun(
      await curriculumXlsx({}, [
        { courseCode: codes[0], plannedSemester: '1' },
      ]),
      versionId,
    );
    expect(batch.report?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ROW_REMOVED' }),
      ]),
    );
    expect(await prisma.curriculumItem.count({ where: { versionId } })).toBe(2);
    expect((await commit(batch)).status).toBe(ImportBatchStatus.COMMITTED);
    expect(await prisma.curriculumItem.count({ where: { versionId } })).toBe(1);
    expect(
      await prisma.coursePLOMapping.count({
        where: { curriculumItemId: removed.id },
      }),
    ).toBe(0);
    expect(
      await prisma.cLOPLOMapping.count({
        where: { curriculumItemId: removed.id },
      }),
    ).toBe(0);
  });

  it('validates 1000 curriculum rows within the 30-second NFR budget', async () => {
    const { versionId } = await draft();
    const codes = await seedCourses(1000);
    const bytes = await curriculumXlsx(
      {},
      codes.map((courseCode, index) => ({
        courseCode,
        plannedSemester: String((index % 8) + 1),
      })),
    );
    const start = performance.now();
    const response = await upload(bytes, versionId).expect(201);
    expect(response.body.status).toBe(ImportBatchStatus.VALIDATING);
    const batch = await waitForBatch(
      admin,
      response.body.id,
      [ImportBatchStatus.DRY_RUN],
      Math.max(1, IMPORT_E2E_BUDGET_MS - (performance.now() - start)),
    );
    expect(batch.totalRows).toBe(1000);
    expect(performance.now() - start).toBeLessThan(IMPORT_E2E_BUDGET_MS);
  });
  it('enforces current permission cells, program scope, history visibility and commit ownership', async () => {
    const own = await draft();
    const outside = await draft();
    await assignDirector(app, {
      programId: own.program.id,
      userId: directorId,
    });
    const codes = await seedCourses(1);
    const bytes = await curriculumXlsx({}, [
      { courseCode: codes[0], plannedSemester: '1' },
    ]);
    const ownBatch = await dryRun(bytes, own.versionId, director);
    expect(ownBatch.status).toBe(ImportBatchStatus.DRY_RUN);
    const outsideBatch = await dryRun(bytes, outside.versionId);
    const catalogBatch = await dryRun(
      await catalogXlsx([catalogRow(unique('SCOPE'))]),
    );
    const forbidden = await upload(bytes, outside.versionId, director).expect(
      403,
    );
    expect(forbidden.body.code).toBe('OUT_OF_SCOPE');
    expect(
      await prisma.importBatch.count({
        where: { versionId: outside.versionId, performedById: directorId },
      }),
    ).toBe(0);
    expect(
      (
        await upload(
          await catalogXlsx([catalogRow(unique('DENY'))]),
          undefined,
          director,
        ).expect(403)
      ).body.code,
    ).toBe('OUT_OF_SCOPE');
    await upload(bytes, own.versionId, denied).expect(403);
    const types = await director.get('/api/imports/types').expect(200);
    expect(types.body).toEqual([
      { importType: 'CURRICULUM', needsVersion: true },
    ]);
    const targets = await director
      .get('/api/imports/curriculum-targets')
      .expect(200);
    expect(
      targets.body.map((row: { versionId: string }) => row.versionId),
    ).toContain(own.versionId);
    expect(
      targets.body.map((row: { versionId: string }) => row.versionId),
    ).not.toContain(outside.versionId);
    const history = await director.get('/api/imports?pageSize=100').expect(200);
    const ids = history.body.items.map((row: { id: string }) => row.id);
    expect(ids).toContain(ownBatch.id);
    expect(ids).not.toContain(outsideBatch.id);
    expect(ids).not.toContain(catalogBatch.id);
    await director.get(`/api/imports/${outsideBatch.id}`).expect(404);
    await director.get(`/api/imports/${outsideBatch.id}/file`).expect(404);
    await director
      .get(`/api/program-versions/${outside.versionId}/curriculum/export`)
      .expect(403);
    await exportBytes(own.versionId, director);
    await denied
      .get(`/api/program-versions/${own.versionId}/curriculum/export`)
      .expect(403);
    for (const path of [
      '/api/imports',
      `/api/imports/${ownBatch.id}`,
      `/api/imports/${ownBatch.id}/file`,
      '/api/imports/types',
      '/api/imports/curriculum-targets',
      '/api/imports/templates/CURRICULUM',
    ])
      await denied.get(path).expect(403);
    const notOwner = await otherAdmin
      .post(`/api/imports/${catalogBatch.id}/commit`)
      .set(CSRF)
      .expect(403);
    expect(notOwner.body.code).toBe('IMPORT_NOT_OWNER');
    expect((await commit(ownBatch, director)).status).toBe(
      ImportBatchStatus.COMMITTED,
    );
  });

  it('rejects oversized uploads and expires only the stored file, not history', async () => {
    const count = await prisma.importBatch.count();
    const tooLarge = await upload(Buffer.alloc(6 * 1024 * 1024)).expect(413);
    expect(tooLarge.body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(await prisma.importBatch.count()).toBe(count);
    const batch = await dryRun(await catalogXlsx([catalogRow(unique('EXP'))]));
    await admin.get(`/api/imports/${batch.id}/file`).expect(200);
    await prisma.importBatchFile.update({
      where: { batchId: batch.id },
      data: { expiresAt: new Date(0) },
    });
    await app
      .get(ImportsProcessor)
      .process({ name: IMPORT_JOB.SWEEP, data: { batchId: '' } });
    const expired = await admin
      .get(`/api/imports/${batch.id}/file`)
      .expect(410);
    expect(expired.body.code).toBe('IMPORT_FILE_EXPIRED');
    expect(
      await prisma.importBatchFile.count({ where: { batchId: batch.id } }),
    ).toBe(0);
    const detail = await admin.get(`/api/imports/${batch.id}`).expect(200);
    expect(detail.body).toMatchObject({
      fileAvailable: false,
      canCommit: false,
    });
    const history = await admin
      .get('/api/imports?mine=true&pageSize=100')
      .expect(200);
    expect(history.body.items.map((row: { id: string }) => row.id)).toContain(
      batch.id,
    );
  });

  it('updates an unreleased catalog course, but refuses imports after a real release', async () => {
    const course = await createCourse(app, { courseCode: unique('UPD') });
    const changed = {
      ...catalogRow(course.courseCode),
      courseName: 'Tên học phần đã sửa',
    };
    const batch = await dryRun(await catalogXlsx([changed]));
    expect(batch.status).toBe(ImportBatchStatus.DRY_RUN);
    expect(batch.report?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'WILL_UPDATE', severity: 'HIGH' }),
      ]),
    );
    expect((await commit(batch)).status).toBe(ImportBatchStatus.COMMITTED);
    expect(
      (await prisma.course.findUniqueOrThrow({ where: { id: course.id } }))
        .courseName,
    ).toBe(changed.courseName);
    const { program, versionId } = await draft();
    await prisma.programVersion.update({
      where: { id: versionId },
      data: { totalCredits: '3', compulsoryCredits: '3', electiveCredits: '0' },
    });
    await addCurriculumItem(admin, versionId, {
      courseId: course.id,
      plannedSemester: 1,
    });
    await releaseViaApi(app, admin, { programId: program.id, versionId });
    const releasedCourse = await dryRun(
      await catalogXlsx([
        { ...changed, courseName: 'Không được sửa trực tiếp' },
      ]),
    );
    expect(releasedCourse.status).toBe(ImportBatchStatus.ABORTED);
    expect(releasedCourse.report?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COURSE_RELEASED', severity: 'ERROR' }),
      ]),
    );
    const ordinary = await prisma.programVersion.create({
      data: {
        programId: program.id,
        programName: 'Nháp sau ban hành',
        majorCode: 'M01',
        majorName: 'Ngành mẫu',
        semesterCount: 8,
        totalCredits: '3',
        compulsoryCredits: '3',
        electiveCredits: '0',
      },
    });
    const refused = await upload(
      await curriculumXlsx({}, [
        { courseCode: course.courseCode, plannedSemester: '1' },
      ]),
      ordinary.id,
    ).expect(409);
    expect(refused.body.code).toBe('CHANGE_REQUEST_REQUIRED');
    const targets = await admin
      .get('/api/imports/curriculum-targets')
      .expect(200);
    expect(
      targets.body.map((row: { versionId: string }) => row.versionId),
    ).not.toContain(ordinary.id);
    const exported = await readSheet(
      await exportBytes(versionId),
      CURRICULUM_SHEET,
    );
    expect(exported.rows[0].cells.courseName).toBe(changed.courseName);
  });
});
