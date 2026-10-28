import { ImportType, type Prisma } from '../../generated/prisma/client.js';
import type { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import type { AppliedProgramVersionReader } from '../../shared/releases/applied-program-version.reader.js';
import type {
  AcademicResultImportPlan,
  StudentImportPlan,
} from '../../shared/students/student-import.types.js';
import { assertSupported } from './import-access.js';
import {
  COURSE_CATALOG_SHEET,
  type CatalogColumnKey,
} from './sheets/course-catalog.sheet.js';
import {
  CURRICULUM_SHEET,
  REQUISITE_COLUMNS,
  REQUISITE_ENTRY_SEPARATOR,
  REQUISITE_CODE_TOKEN,
  type CurriculumColumnKey,
  type ProgramHeaderKey,
} from './sheets/curriculum.sheet.js';
import {
  ACADEMIC_RESULT_SHEET,
  RESULT_IDENTITY_COLUMNS,
  type ResultColumn,
} from './sheets/academic-result.sheet.js';
import {
  findNonTextIdentityCells,
  type NonTextCells,
} from './sheets/identity-cells.js';
import { readSheet, type ParsedSheet } from './sheets/sheet-reader.js';
import {
  STUDENT_IDENTITY_COLUMNS,
  STUDENT_LIST_SHEET,
  type StudentColumn,
} from './sheets/student-list.sheet.js';
import { loadAcademicResultContext } from './validation/academic-result-context.js';
import { validateAcademicResultRows } from './validation/academic-result-validator.js';
import { loadStudentContext } from './validation/student-context.js';
import { validateStudentRows } from './validation/student-validator.js';
import { loadCatalogContext } from './validation/catalog-context.js';
import {
  validateCatalogRows,
  type CatalogPlan,
} from './validation/catalog-validator.js';
import { loadCurriculumContext } from './validation/curriculum-context.js';
import {
  validateCurriculumRows,
  type CurriculumPlan,
} from './validation/curriculum-validator.js';
import type { ValidationResult } from './validation/import-report.js';

export type ParsedImport =
  | {
      importType: typeof ImportType.COURSE_CATALOG;
      sheet: ParsedSheet<CatalogColumnKey, string>;
    }
  | {
      importType: typeof ImportType.CURRICULUM;
      sheet: ParsedSheet<CurriculumColumnKey, ProgramHeaderKey>;
    }
  | {
      importType: typeof ImportType.STUDENT_LIST;
      sheet: ParsedSheet<StudentColumn, string>;
      nonText: NonTextCells<StudentColumn>;
    }
  | {
      importType: typeof ImportType.ACADEMIC_RESULT;
      sheet: ParsedSheet<ResultColumn, string>;
      nonText: NonTextCells<ResultColumn>;
    };
export type ValidatedImport =
  | ({
      importType: typeof ImportType.COURSE_CATALOG;
    } & ValidationResult<CatalogPlan>)
  | ({
      importType: typeof ImportType.CURRICULUM;
    } & ValidationResult<CurriculumPlan>)
  | ({
      importType: typeof ImportType.STUDENT_LIST;
    } & ValidationResult<StudentImportPlan>)
  | ({
      importType: typeof ImportType.ACADEMIC_RESULT;
    } & ValidationResult<AcademicResultImportPlan>);

export async function readImportSheet(
  importType: ImportType,
  content: Uint8Array,
): Promise<ParsedImport> {
  assertSupported(importType);
  if (importType === ImportType.COURSE_CATALOG)
    return { importType, sheet: await readSheet(content, COURSE_CATALOG_SHEET) };
  if (importType === ImportType.STUDENT_LIST)
    return {
      importType,
      sheet: await readSheet(content, STUDENT_LIST_SHEET),
      nonText: await findNonTextIdentityCells(
        content,
        STUDENT_LIST_SHEET,
        STUDENT_IDENTITY_COLUMNS,
      ),
    };
  if (importType === ImportType.ACADEMIC_RESULT)
    return {
      importType,
      sheet: await readSheet(content, ACADEMIC_RESULT_SHEET),
      nonText: await findNonTextIdentityCells(
        content,
        ACADEMIC_RESULT_SHEET,
        RESULT_IDENTITY_COLUMNS,
      ),
    };
  return {
    importType: ImportType.CURRICULUM,
    sheet: await readSheet(content, CURRICULUM_SHEET),
  };
}
export async function validateImport(
  client: Prisma.TransactionClient,
  usage: CourseUsageReader,
  parsed: ParsedImport,
  versionId: string | null,
  appliedVersions?: AppliedProgramVersionReader,
): Promise<ValidatedImport> {
  if (parsed.importType === ImportType.STUDENT_LIST) {
    if (!appliedVersions) throw new Error('Student import needs the applied-version reader');
    const context = await loadStudentContext(client, parsed.sheet.rows, appliedVersions);
    return {
      importType: parsed.importType,
      ...validateStudentRows(parsed.sheet.rows, context, parsed.nonText),
    };
  }
  if (parsed.importType === ImportType.ACADEMIC_RESULT) {
    const context = await loadAcademicResultContext(client, parsed.sheet.rows);
    return {
      importType: parsed.importType,
      ...validateAcademicResultRows(parsed.sheet.rows, context, parsed.nonText),
    };
  }
  const codes = new Set(
    parsed.sheet.rows.map((row) => row.cells.courseCode.trim().toUpperCase()),
  );
  if (parsed.importType === ImportType.COURSE_CATALOG) {
    const context = await loadCatalogContext(client, usage, [...codes]);
    return {
      importType: parsed.importType,
      ...validateCatalogRows(
        parsed.sheet.rows,
        context,
        parsed.sheet.unknownColumns,
      ),
    };
  }
  if (!versionId) throw new Error('Curriculum batch has no version');
  for (const row of parsed.sheet.rows)
    for (const column of REQUISITE_COLUMNS)
      for (const entry of row.cells[column.key].split(
        REQUISITE_ENTRY_SEPARATOR,
      )) {
        const code = REQUISITE_CODE_TOKEN.exec(entry)?.[1];
        if (code) codes.add(code.toUpperCase());
      }
  const context = await loadCurriculumContext(client, versionId, [...codes]);
  return {
    importType: parsed.importType,
    ...validateCurriculumRows(parsed.sheet, context),
  };
}
