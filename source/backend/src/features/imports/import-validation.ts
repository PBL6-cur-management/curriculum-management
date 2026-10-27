import { ImportType, type Prisma } from '../../generated/prisma/client.js';
import type { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
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
import { readSheet, type ParsedSheet } from './sheets/sheet-reader.js';
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
    };
export type ValidatedImport =
  | ({
      importType: typeof ImportType.COURSE_CATALOG;
    } & ValidationResult<CatalogPlan>)
  | ({
      importType: typeof ImportType.CURRICULUM;
    } & ValidationResult<CurriculumPlan>);

export async function readImportSheet(
  importType: ImportType,
  content: Uint8Array,
): Promise<ParsedImport> {
  assertSupported(importType);
  return importType === ImportType.COURSE_CATALOG
    ? { importType, sheet: await readSheet(content, COURSE_CATALOG_SHEET) }
    : {
        importType: ImportType.CURRICULUM,
        sheet: await readSheet(content, CURRICULUM_SHEET),
      };
}
export async function validateImport(
  client: Prisma.TransactionClient,
  usage: CourseUsageReader,
  parsed: ParsedImport,
  versionId: string | null,
): Promise<ValidatedImport> {
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
