import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessContext } from '../../shared/authz/access-context.js';
import type {
  GraduationResult,
  GraduationShortfall,
} from '../../shared/graduation/graduation.types.js';
import type { GraduationBatchesService } from './graduation-batches.service.js';
import { GraduationExportService } from './graduation-export.service.js';

const context: GraduationResult['context'] = {
  studentId: 'student-synthetic',
  studentCode: '000123',
  fullName: 'Sinh viên tổng hợp',
  programId: 'program-synthetic',
  programCode: 'SYN-P',
  programName: 'Chương trình tổng hợp',
  semesterId: 'semester-synthetic',
  semesterCode: 'SYN-2026-1',
  semesterStartDate: '2026-09-01',
  enrollmentId: 'enrollment-synthetic',
  cohortId: 'cohort-synthetic',
  cohortCode: 'SYN-C',
  programVersionId: 'version-synthetic',
  versionNumber: '1.0',
  versionSource: 'COHORT',
  cohortAssignmentId: 'assignment-synthetic',
};
const course = {
  id: 'course-synthetic',
  courseCode: 'SYN101',
  courseName: 'Học phần tổng hợp',
};
const shortfalls: GraduationShortfall[] = [
  {
    code: 'MANDATORY_COURSE_MISSING',
    category: 'MANDATORY_COURSE',
    curriculumItemId: 'item-required',
    course,
    blockSymbol: null,
    reason: 'FAILED',
    message: 'Chưa đạt học phần bắt buộc SYN101.',
  },
  {
    code: 'ELECTIVE_CREDITS_MISSING',
    category: 'ELECTIVE_GROUP',
    groupId: 'group-synthetic',
    groupCode: 'SYN-E',
    groupName: 'Nhóm tổng hợp',
    requiredCredits: '6.125',
    earnedCredits: '3.1',
    missingCredits: '3.025',
    message: 'Còn thiếu 3.025 tín chỉ tự chọn.',
  },
  {
    code: 'ELECTIVE_COURSES_MISSING',
    category: 'ELECTIVE_GROUP',
    groupId: 'group-synthetic',
    groupCode: 'SYN-E',
    groupName: 'Nhóm tổng hợp',
    requiredCourses: 2,
    earnedCourses: 0,
    missingCourses: 2,
    message: 'Còn thiếu 2 học phần tự chọn.',
  },
  {
    code: 'TOTAL_CREDITS_MISSING',
    category: 'TOTAL_CREDITS',
    requiredCredits: '120.125',
    earnedCredits: '117.1',
    missingCredits: '3.025',
    message: 'Còn thiếu 3.025 tín chỉ tích lũy.',
  },
  {
    code: 'CONDITIONAL_COURSE_MISSING',
    category: 'CONDITIONAL_COURSE',
    curriculumItemId: 'item-conditional',
    course,
    blockSymbol: null,
    reason: 'IN_PROGRESS',
    message: 'Chưa hoàn thành học phần điều kiện SYN101.',
  },
];

function resultFor(entries: GraduationShortfall[]): GraduationResult {
  return {
    schemaVersion: 1,
    ruleVersion: 'graduation-v1',
    evaluatedAt: '2026-10-30T00:00:00.000Z',
    context: { ...context },
    conclusion: entries.length ? 'NOT_ELIGIBLE' : 'ELIGIBLE',
    shortfalls: entries,
    warnings: [],
    credits: {
      requiredTotal: '120.125',
      recognizedTotal: '117.1',
      missingTotal: '3.025',
      compulsory: '90',
      elective: '24.1',
      free: '3',
    },
    electiveGroups: [],
    knowledgeBlocks: [],
    recognitions: [],
    freeCredits: [],
  };
}

function sourceFor(result = resultFor(shortfalls)) {
  return {
    batch: {
      id: 'batch-synthetic',
      status: 'COMPLETED_WITH_ERRORS',
      filters: {
        semesterId: context.semesterId,
        cohortId: null,
        programId: null,
      },
      studentCount: 2,
      enrollmentCount: 2,
      processedCount: 2,
      eligibleCount: 0,
      notEligibleCount: 1,
      errorCount: 1,
    },
    items: [
      {
        id: 'item-reviewed',
        status: 'REVIEWED',
        rosterIdentity: { ...context },
        audit: {
          id: 'audit-historical',
          auditedAt: new Date(result.evaluatedAt),
          result,
        },
        errorCode: null,
        errorMessage: null,
      },
      {
        id: 'item-error',
        status: 'ERROR',
        rosterIdentity: {
          ...context,
          studentCode: '000124',
          fullName: 'Sinh viên lỗi',
        },
        audit: null,
        errorCode: 'ENROLLMENT_AMBIGUOUS',
        errorMessage: 'Cần kiểm tra các khoảng thời gian theo học chồng lấn.',
      },
    ],
  };
}

async function readWorkbook(body: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(body).buffer);
  return workbook;
}

describe('GraduationExportService', () => {
  const exportRows = vi.fn();
  const batches = { exportRows } as unknown as GraduationBatchesService;
  const service = new GraduationExportService(batches);
  const access = new AccessContext('office-synthetic', []);

  beforeEach(() => {
    exportRows.mockReset().mockResolvedValue(sourceFor());
  });

  it('delegates access, terminal checks, filters and SQL ordering to the scoped batch helper', async () => {
    const filters = {
      q: '000123',
      conclusion: 'NOT_ELIGIBLE' as const,
      outcome: 'REVIEWED' as const,
    };
    const source = sourceFor();
    source.items = source.items.slice(0, 1);
    exportRows.mockResolvedValue(source);
    const output = await service.export(access, 'batch-synthetic', filters);
    expect(exportRows).toHaveBeenCalledExactlyOnceWith(
      access,
      'batch-synthetic',
      filters,
    );
    expect(output.fileName).toBe('xet-tot-nghiep-batch-synthetic.xlsx');
    expect(output.mime).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const workbook = await readWorkbook(output.body);
    expect(workbook.getWorksheet('Kết quả')!.rowCount).toBe(2);
    expect(workbook.getWorksheet('Tổng hợp')!.getCell('L2').value).toBe(
      JSON.stringify(filters),
    );
  });

  it('writes the exact three sheets, frozen Vietnamese headings and schema metadata', async () => {
    const workbook = await readWorkbook(
      (await service.export(access, 'batch-synthetic', {})).body,
    );
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Tổng hợp',
      'Kết quả',
      'Hạng mục thiếu',
    ]);
    expect(workbook.description).toBe(
      'schemaVersion=1; ruleVersion=graduation-v1',
    );
    for (const sheet of workbook.worksheets) {
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(sheet.getRow(1).font).toMatchObject({ bold: true });
    }
    expect(workbook.getWorksheet('Tổng hợp')!.columnCount).toBe(12);
    expect(workbook.getWorksheet('Kết quả')!.columnCount).toBe(15);
    expect(workbook.getWorksheet('Hạng mục thiếu')!.columnCount).toBe(16);
  });

  it('preserves leading zeroes, exact decimals, saved audit identity and all five shortfall shapes', async () => {
    const workbook = await readWorkbook(
      (await service.export(access, 'batch-synthetic', {})).body,
    );
    const sheet = workbook.getWorksheet('Kết quả')!;
    expect(sheet.getCell('A2').value).toBe('000123');
    expect(sheet.getCell('A2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('G2').value).toBe('120.125');
    expect(sheet.getCell('H2').value).toBe('117.1');
    expect(sheet.getCell('I2').value).toBe('3.025');
    expect(sheet.getCell('J2').value).toBe(5);
    expect(sheet.getCell('K2').value).toBe(
      shortfalls.map((entry) => entry.message).join('\n'),
    );
    expect(sheet.getCell('L2').value).toBe('audit-historical');
    expect(sheet.getCell('M2').value).toBe('2026-10-30T00:00:00.000Z');
    const detail = workbook.getWorksheet('Hạng mục thiếu')!;
    expect(detail.rowCount).toBe(6);
    expect(detail.getColumn(5).values.slice(2)).toEqual(
      shortfalls.map((entry) => entry.code),
    );
    expect(detail.getCell('F2').value).toBe('SYN101');
    expect(detail.getCell('H3').value).toBe('SYN-E');
    expect(detail.getCell('J3').value).toBe('6.125');
    expect(detail.getCell('K3').value).toBe('3.1');
    expect(detail.getCell('L3').value).toBe('3.025');
    expect(detail.getCell('J4').value).toBeNull();
    expect(detail.getCell('N4').value).toBe(0);
    expect(detail.getCell('M3').value).toBeNull();
    expect(detail.getCell('F5').value).toBeNull();
    expect(detail.getCell('H5').value).toBeNull();
    expect(detail.getCell('J5').value).toBe('120.125');
    expect(detail.getCell('F6').value).toBe('SYN101');
  });

  it('keeps operational errors separate from academic conclusions and missing credits', async () => {
    const workbook = await readWorkbook(
      (await service.export(access, 'batch-synthetic', {})).body,
    );
    const sheet = workbook.getWorksheet('Kết quả')!;
    expect(sheet.getCell('F3').value).toBe('Không xét được');
    for (const column of ['E', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) {
      expect(sheet.getCell(`${column}3`).value).toBeNull();
    }
    expect(sheet.getCell('N3').value).toBe('ENROLLMENT_AMBIGUOUS');
    expect(sheet.getCell('O3').value).toBe(
      'Cần kiểm tra các khoảng thời gian theo học chồng lấn.',
    );
    const summary = workbook.getWorksheet('Tổng hợp')!;
    expect(summary.getCell('E2').value).toBe(2);
    expect(summary.getCell('F2').value).toBe(2);
    expect(summary.getCell('G2').value).toBe(2);
    expect(summary.getCell('H2').value).toBe(0);
    expect(summary.getCell('I2').value).toBe(1);
    expect(summary.getCell('J2').value).toBe(1);
  });

  it('describes eligible results without inventing shortfalls or false zero cells', async () => {
    const source = sourceFor(resultFor([]));
    source.items = source.items.slice(0, 1);
    exportRows.mockResolvedValue(source);
    const workbook = await readWorkbook(
      (await service.export(access, 'batch-synthetic', {})).body,
    );
    expect(workbook.getWorksheet('Kết quả')!.getCell('F2').value).toBe(
      'Đủ điều kiện',
    );
    expect(workbook.getWorksheet('Kết quả')!.getCell('K2').value).toBe(
      'Không còn thiếu hạng mục nào',
    );
    expect(workbook.getWorksheet('Hạng mục thiếu')!.rowCount).toBe(1);
  });

  it.each(['=1+1', '+SUM(1,2)', '-1+1', '@SUM(1,2)', '\t=1+1', '\r=1+1'])(
    'stores hostile content as literal XLSX text: %s',
    async (payload) => {
      const source = sourceFor();
      source.items[0].rosterIdentity.fullName = payload;
      source.items[0].audit!.result.shortfalls = shortfalls.map(
        (shortfall) => ({ ...shortfall, message: payload }),
      );
      source.items[1].errorMessage = payload;
      exportRows.mockResolvedValue(source);
      const workbook = await readWorkbook(
        (await service.export(access, 'batch-synthetic', {})).body,
      );
      for (const cell of [
        workbook.getWorksheet('Kết quả')!.getCell('B2'),
        workbook.getWorksheet('Kết quả')!.getCell('O3'),
        workbook.getWorksheet('Hạng mục thiếu')!.getCell('P2'),
      ]) {
        expect(cell.type).toBe(ExcelJS.ValueType.String);
        // XML end-of-line normalization turns a stored CR into LF on read.
        expect(cell.value).toBe(payload.replace('\r', '\n'));
        expect(cell.formula).toBeUndefined();
        expect(cell.numFmt).toBe('@');
      }
    },
  );

  it('exports the historical item audit unchanged after a later correction exists', async () => {
    const source = sourceFor();
    const currentResult = resultFor([]);
    exportRows.mockResolvedValue(source);
    const workbook = await readWorkbook(
      (await service.export(access, 'batch-synthetic', {})).body,
    );
    expect(currentResult.conclusion).toBe('ELIGIBLE');
    expect(workbook.getWorksheet('Kết quả')!.getCell('F2').value).toBe(
      'Chưa đủ điều kiện',
    );
    expect(workbook.getWorksheet('Kết quả')!.getCell('L2').value).toBe(
      'audit-historical',
    );
    expect(source.items[0].audit!.result.shortfalls).toHaveLength(5);
  });

  it('propagates revoked-access, nonterminal and failed-batch rejection without an artifact', async () => {
    const failure = new Error('Synthetic scoped batch export denial');
    exportRows.mockRejectedValue(failure);
    await expect(service.export(access, 'batch-synthetic', {})).rejects.toBe(
      failure,
    );
  });

  it('retains valid sheet headings and full batch counters for an empty filtered result', async () => {
    const source = sourceFor();
    source.items = [];
    exportRows.mockResolvedValue(source);
    const workbook = await readWorkbook(
      (await service.export(access, 'batch-synthetic', { q: 'no-match' })).body,
    );
    expect(workbook.getWorksheet('Kết quả')!.rowCount).toBe(1);
    expect(workbook.getWorksheet('Hạng mục thiếu')!.rowCount).toBe(1);
    expect(workbook.getWorksheet('Tổng hợp')!.getCell('G2').value).toBe(2);
  });
});
