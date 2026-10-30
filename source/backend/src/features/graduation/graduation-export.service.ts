import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { AccessContext } from '../../shared/authz/access-context.js';
import {
  GRADUATION_RULE_VERSION,
  GRADUATION_SCHEMA_VERSION,
} from '../../shared/graduation/graduation.constants.js';
import type {
  GraduationConclusion,
  GraduationShortfall,
} from '../../shared/graduation/graduation.types.js';
import { GraduationBatchesService } from './graduation-batches.service.js';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CONCLUSION_LABELS: Record<GraduationConclusion, string> = {
  ELIGIBLE: 'Đủ điều kiện',
  NOT_ELIGIBLE: 'Chưa đủ điều kiện',
};
const SUMMARY_HEADINGS = [
  'Mã đợt',
  'Học kỳ',
  'Khóa',
  'Chương trình',
  'Số sinh viên',
  'Số ghi danh',
  'Đã xử lý',
  'Đủ điều kiện',
  'Chưa đủ điều kiện',
  'Lỗi xét',
  'Thời điểm xuất',
  'Bộ lọc',
];
const RESULT_HEADINGS = [
  'Mã sinh viên',
  'Họ tên',
  'Chương trình',
  'Học kỳ',
  'Phiên bản áp dụng',
  'Kết luận',
  'Tín chỉ yêu cầu',
  'Tín chỉ công nhận',
  'Tín chỉ thiếu',
  'Số hạng mục thiếu',
  'Tóm tắt hạng mục thiếu',
  'Mã lần xét',
  'Thời điểm xét',
  'Mã lỗi',
  'Chi tiết lỗi',
];
const SHORTFALL_HEADINGS = [
  'Mã sinh viên',
  'Chương trình',
  'Mã lần xét',
  'Nhóm thiếu',
  'Mã thiếu',
  'Mã học phần',
  'Tên học phần',
  'Mã nhóm tự chọn',
  'Tên nhóm tự chọn',
  'Yêu cầu tín chỉ',
  'Đã có tín chỉ',
  'Thiếu tín chỉ',
  'Yêu cầu học phần',
  'Đã có học phần',
  'Thiếu học phần',
  'Chi tiết',
];

type CellValue = string | number | null | undefined;
type ExportFilters = Parameters<GraduationBatchesService['exportRows']>[2];

function addRow(sheet: ExcelJS.Worksheet, values: CellValue[]): void {
  const row = sheet.addRow(values.map((value) => value ?? null));
  values.forEach((value, index) => {
    if (typeof value === 'string') {
      const cell = row.getCell(index + 1);
      cell.value = value;
      cell.numFmt = '@';
    }
  });
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headings: string[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name);
  addRow(sheet, headings);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  headings.forEach((heading, index) => {
    sheet.getColumn(index + 1).width = Math.min(
      Math.max(heading.length + 4, 18),
      40,
    );
  });
  return sheet;
}

function shortfallCells(shortfall: GraduationShortfall): CellValue[] {
  const course = 'course' in shortfall ? shortfall.course : null;
  const group = 'groupCode' in shortfall ? shortfall : null;
  const credits = 'requiredCredits' in shortfall ? shortfall : null;
  const courses = 'requiredCourses' in shortfall ? shortfall : null;
  return [
    shortfall.category,
    shortfall.code,
    course?.courseCode,
    course?.courseName,
    group?.groupCode,
    group?.groupName,
    credits?.requiredCredits,
    credits?.earnedCredits,
    credits?.missingCredits,
    courses?.requiredCourses,
    courses?.earnedCourses,
    courses?.missingCourses,
    shortfall.message,
  ];
}

@Injectable()
export class GraduationExportService {
  constructor(private readonly batches: GraduationBatchesService) {}

  async export(
    access: AccessContext,
    batchId: string,
    filters: ExportFilters,
  ): Promise<{ body: Uint8Array; fileName: string; mime: string }> {
    const { batch, items } = await this.batches.exportRows(
      access,
      batchId,
      filters,
    );
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống Quản lý Chương trình đào tạo';
    workbook.description = `schemaVersion=${GRADUATION_SCHEMA_VERSION}; ruleVersion=${GRADUATION_RULE_VERSION}`;
    const exportedAt = new Date().toISOString();
    const summary = addSheet(workbook, 'Tổng hợp', SUMMARY_HEADINGS);
    const results = addSheet(workbook, 'Kết quả', RESULT_HEADINGS);
    const shortfalls = addSheet(workbook, 'Hạng mục thiếu', SHORTFALL_HEADINGS);
    addRow(summary, [
      batch.id,
      batch.filters.semesterId,
      batch.filters.cohortId,
      batch.filters.programId,
      batch.studentCount,
      batch.enrollmentCount,
      batch.processedCount,
      batch.eligibleCount,
      batch.notEligibleCount,
      batch.errorCount,
      exportedAt,
      JSON.stringify(filters),
    ]);
    for (const item of items) {
      const identity = item.rosterIdentity;
      const audit = item.audit;
      const result = audit?.result;
      addRow(results, [
        identity.studentCode,
        identity.fullName,
        identity.programCode,
        identity.semesterCode,
        result?.context.versionNumber,
        result ? CONCLUSION_LABELS[result.conclusion] : 'Không xét được',
        result?.credits.requiredTotal,
        result?.credits.recognizedTotal,
        result?.credits.missingTotal,
        result?.shortfalls.length,
        result
          ? result.shortfalls.length
            ? result.shortfalls.map((entry) => entry.message).join('\n')
            : 'Không còn thiếu hạng mục nào'
          : null,
        audit?.id,
        audit?.auditedAt instanceof Date
          ? audit.auditedAt.toISOString()
          : audit?.auditedAt,
        item.errorCode,
        item.errorMessage,
      ]);
      if (result && audit) {
        for (const shortfall of result.shortfalls) {
          addRow(shortfalls, [
            identity.studentCode,
            identity.programCode,
            audit.id,
            ...shortfallCells(shortfall),
          ]);
        }
      }
    }
    return {
      body: new Uint8Array(await workbook.xlsx.writeBuffer()),
      fileName: `xet-tot-nghiep-${batchId}.xlsx`,
      mime: XLSX_MIME,
    };
  }
}
