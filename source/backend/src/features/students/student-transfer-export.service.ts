import ExcelJS from 'exceljs';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { staffStudentScope } from '../../shared/students/student-access.js';
import type { TransferExportQueryDto } from './dto/student-transfer.dto.js';

export const TRANSFER_EXPORT_MAX_ROWS = 20_000;
export const TRANSFER_EXPORT_SHEET = 'Lịch sử chuyển CTĐT';
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const TRANSFER_EXPORT_HEADINGS = [
  'Mã SV',
  'Họ tên',
  'Khóa',
  'CTĐT cũ',
  'Phiên bản cũ',
  'CTĐT mới',
  'Phiên bản mới',
  'Định hướng',
  'Từ học kỳ',
  'Số quyết định / căn cứ',
  'Trạng thái',
  'Ngày chuyển',
] as const;
const WIDTHS = [14, 28, 12, 28, 14, 28, 14, 24, 14, 36, 16, 14];
const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'Đang áp dụng',
  TRANSFERRED: 'Đã chuyển tiếp',
  ENDED: 'Đã kết thúc',
};

// A text cell that starts with one of these is evaluated as a formula by spreadsheet apps.
function safeText(value: string | null | undefined): string {
  const text = value ?? '';
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
function formatDate(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
}

@Injectable()
export class StudentTransferExportService {
  constructor(private readonly prisma: PrismaService) {}

  // One row per transfer: the enrollment created by a TRANSFER (it points back to the one it closed).
  async export(
    access: AccessContext,
    query: TransferExportQueryDto,
  ): Promise<{ content: Uint8Array; fileName: string }> {
    const scope = staffStudentScope(access);
    const search = query.search?.trim();
    const where: Prisma.ProgramEnrollmentWhereInput = {
      previousEnrollmentId: { not: null },
      ...(query.programId ? { programId: query.programId } : {}),
      ...(scope.all
        ? {}
        : {
            OR: [
              { programId: { in: [...scope.programIds] } },
              {
                previousEnrollment: {
                  programId: { in: [...scope.programIds] },
                },
              },
            ],
          }),
      student: {
        ...(query.cohortId ? { cohortId: query.cohortId } : {}),
        ...(search
          ? {
              OR: [
                { studentCode: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };
    const rows = await this.prisma.programEnrollment.findMany({
      where,
      orderBy: [{ student: { studentCode: 'asc' } }, { createdAt: 'asc' }],
      take: TRANSFER_EXPORT_MAX_ROWS,
      select: {
        status: true,
        basisDecision: true,
        createdAt: true,
        student: {
          select: {
            studentCode: true,
            fullName: true,
            cohort: { select: { cohortCode: true } },
          },
        },
        program: { select: { programCode: true } },
        appliedVersion: {
          select: { programName: true, versionNumber: true },
        },
        track: { select: { trackCode: true, trackName: true } },
        fromSemester: { select: { semesterCode: true } },
        previousEnrollment: {
          select: {
            program: { select: { programCode: true } },
            appliedVersion: {
              select: { programName: true, versionNumber: true },
            },
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(TRANSFER_EXPORT_SHEET);
    const heading = sheet.addRow([...TRANSFER_EXPORT_HEADINGS]);
    heading.font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    WIDTHS.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    for (const row of rows) {
      const previous = row.previousEnrollment;
      sheet.addRow([
        safeText(row.student.studentCode),
        safeText(row.student.fullName),
        safeText(row.student.cohort.cohortCode),
        previous
          ? safeText(
              `${previous.program.programCode} - ${previous.appliedVersion.programName}`,
            )
          : '',
        safeText(previous?.appliedVersion.versionNumber),
        safeText(
          `${row.program.programCode} - ${row.appliedVersion.programName}`,
        ),
        safeText(row.appliedVersion.versionNumber),
        row.track
          ? safeText(`${row.track.trackCode} - ${row.track.trackName}`)
          : '',
        safeText(row.fromSemester.semesterCode),
        safeText(row.basisDecision),
        STATUS_TEXT[row.status] ?? row.status,
        formatDate(row.createdAt),
      ]);
    }
    return {
      content: new Uint8Array(await workbook.xlsx.writeBuffer()),
      fileName: 'lich_su_chuyen_ctdt.xlsx',
    };
  }
}
