import ExcelJS from 'exceljs';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  graduationHarness,
  seedGraduationFixture,
  type GraduationFixture,
} from './fixtures/graduation.js';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function binary(
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function sheetNames(body: Buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(body as unknown as ArrayBuffer);
  return book.worksheets.map((sheet) => sheet.name);
}

describe('Accreditation reports (F-23)', () => {
  const harness = graduationHarness();
  let left: GraduationFixture;
  let right: GraduationFixture;

  beforeAll(async () => {
    left = await seedGraduationFixture(harness.app, harness.office);
    right = await seedGraduationFixture(harness.app, harness.office);
  });

  it('compares two programs and exports the same split (US-105)', async () => {
    const query = {
      leftVersionId: left.versionId,
      rightVersionId: right.versionId,
    };
    const res = await harness.office
      .get('/api/reports/program-comparison')
      .query(query)
      .expect(200);
    expect(res.body.summary).toMatchObject({
      sharedCount: 0,
      leftOnlyCount: 4,
      rightOnlyCount: 4,
    });
    await harness.office
      .get('/api/reports/program-comparison')
      .query({ leftVersionId: left.versionId, rightVersionId: left.versionId })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('REPORT_SAME_PROGRAM'));
    const file = await harness.office
      .get('/api/reports/program-comparison/export')
      .query(query)
      .buffer(true)
      .parse(binary)
      .expect(200)
      .expect('Content-Type', XLSX);
    expect(await sheetNames(file.body as Buffer)).toEqual([
      'TomTat',
      'HocPhanChung',
      'TuongDuong',
      'RiengTrai',
      'RiengPhai',
    ]);
  });

  it('distributes every credit once and keeps elective minimums apart (US-106, BR-04)', async () => {
    const res = await harness.office
      .get('/api/reports/credit-distribution')
      .query({ versionId: left.versionId })
      .expect(200);
    expect(res.body.totals).toMatchObject({
      compulsory: '3',
      electiveOffered: '6',
      allRows: '9',
      required: '9',
      requiredIsPartial: false,
    });
    for (const table of ['byBlock', 'bySemester', 'byCourseType'] as const)
      expect(
        (res.body[table] as { total: string }[]).reduce(
          (total, row) => total + Number(row.total),
          0,
        ),
      ).toBe(9);
    expect(res.body.electiveGroups[0]).toMatchObject({
      groupCode: 'TC',
      minCredits: '6',
    });
  });

  it('exports matrices, and builds the accreditation dossier (US-107, US-108)', async () => {
    const matrices = await harness.office
      .get(`/api/reports/versions/${left.versionId}/matrices/export`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(await sheetNames(matrices.body as Buffer)).toEqual([
      'HocPhan_PLO',
      'CLO_PLO',
    ]);
    const dossier = await harness.office
      .get(`/api/reports/versions/${left.versionId}/accreditation/export`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(await sheetNames(dossier.body as Buffer)).toEqual([
      'ThongTin',
      'KhungCTDT',
      'PLO',
      'HocPhan_PLO',
      'CLO_PLO',
      'TongHop',
      'KhoiKienThuc',
      'HocKy',
      'LoaiHocPhan',
      'NhomTuChon',
      'DeCuong',
      'DanhGia',
      'LoHong',
    ]);
  });

  it('counts proposals in the interval and rejects a reversed interval (US-109)', async () => {
    const res = await harness.office
      .get('/api/reports/change-request-statistics')
      .query({ from: '2000-01-01', to: '2100-12-31' })
      .expect(200);
    expect(res.body).toMatchObject({ scoped: false });
    expect(res.body.levels).toHaveLength(3);
    await harness.office
      .get('/api/reports/change-request-statistics')
      .query({ from: '2026-02-01', to: '2026-01-01' })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('REPORT_INTERVAL_INVALID'));
  });

  it('keeps reports to the roles that hold them', async () => {
    const lecturer = await loginAgent(
      harness.app,
      await createAccount(harness.app, 'reportlecturer', 'R5'),
    );
    await lecturer
      .get('/api/reports/credit-distribution')
      .query({ versionId: left.versionId })
      .expect(403);
    await lecturer
      .get(`/api/reports/versions/${left.versionId}/matrices/export`)
      .expect(403);
    await lecturer
      .get('/api/reports/change-request-statistics')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(403);
  });
});
