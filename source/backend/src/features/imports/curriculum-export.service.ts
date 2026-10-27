import { Injectable } from '@nestjs/common';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { rowCourse } from '../../shared/curriculum/row-course.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import { IMPORT_ERRORS } from './import-errors.js';
import { XLSX_EXTENSION } from './import.constants.js';
import {
  CURRICULUM_SHEET,
  REQUISITE_COLUMNS,
  REQUISITE_EXPORT_NAME_SEPARATOR,
  REQUISITE_EXPORT_SEPARATOR,
  SHEET_TRUE_MARK,
  type CurriculumColumnKey,
} from './sheets/curriculum.sheet.js';
import { writeSheet } from './sheets/sheet-writer.js';

const UNSAFE_FILE_CHARS = /[<>:"/\\|?*]|\p{Cc}/gu;

@Injectable()
export class CurriculumExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(versionId: string, access: AccessContext) {
    const version = await this.prisma.programVersion.findUnique({
      where: { id: versionId },
      include: { program: true },
    });
    if (!version) throw new AppException(IMPORT_ERRORS.VERSION_NOT_FOUND);
    access.assertCan(
      PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
      programTarget(version.program),
    );
    const items = await this.prisma.curriculumItem.findMany({
      where: { versionId },
      orderBy: [
        { plannedSemester: 'asc' },
        { sortOrder: 'asc' },
        { id: 'asc' },
      ],
      include: {
        course: {
          select: { courseCode: true, courseName: true, credits: true },
        },
        requisites: {
          orderBy: [
            { relationType: 'asc' },
            { sourceCourse: { courseCode: 'asc' } },
          ],
          include: {
            sourceCourse: { select: { courseCode: true, courseName: true } },
          },
        },
      },
    });
    const rows = items.map(
      (item, index): Partial<Record<CurriculumColumnKey, string>> => {
        const course = rowCourse(item);
        const row: Partial<Record<CurriculumColumnKey, string>> = {
          sequence: String(index + 1),
          blockSymbol: item.blockSymbol ?? '',
          courseCode: course.courseCode,
          courseName: course.courseName,
          credits: toWireDecimal(course.credits),
          plannedSemester: String(item.plannedSemester),
          isElective: item.isElective ? SHEET_TRUE_MARK : '',
          htDa: item.htDa ? SHEET_TRUE_MARK : '',
          tqDa: item.tqDa ? SHEET_TRUE_MARK : '',
          minStudiedScore:
            item.minStudiedScore === null
              ? ''
              : toWireDecimal(item.minStudiedScore),
          minTransferScore:
            item.minTransferScore === null
              ? ''
              : toWireDecimal(item.minTransferScore),
          registrable: '',
          note: item.note ?? '',
        };
        for (const column of REQUISITE_COLUMNS)
          row[column.key] = item.requisites
            .filter(
              (requisite) => requisite.relationType === column.relationType,
            )
            .map(
              (requisite) =>
                `${requisite.sourceCourse.courseCode}${REQUISITE_EXPORT_NAME_SEPARATOR}${requisite.sourceCourse.courseName}`,
            )
            .join(REQUISITE_EXPORT_SEPARATOR);
        return row;
      },
    );
    return {
      content: await writeSheet(
        CURRICULUM_SHEET,
        {
          programCode: version.program.programCode,
          programName: version.programName,
          majorCode: version.majorCode,
          semesterCount: String(version.semesterCount),
          totalCredits: toWireDecimal(version.totalCredits),
          compulsoryCredits: toWireDecimal(version.compulsoryCredits),
          electiveCredits: toWireDecimal(version.electiveCredits),
        },
        rows,
      ),
      fileName:
        `${version.program.programCode}_${version.versionNumber ?? 'nhap'}${XLSX_EXTENSION}`.replace(
          UNSAFE_FILE_CHARS,
          '_',
        ),
    };
  }
}
