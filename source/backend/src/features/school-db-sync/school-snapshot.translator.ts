import type { SchoolMappingKind } from '../../generated/prisma/client.js';
import { RESULT_STATUS_TEXT, type ResultColumn } from '../imports/sheets/academic-result.sheet.js';
import type { SheetRow } from '../imports/sheets/sheet-reader.js';
import { STUDENT_STATUS_TEXT, type StudentColumn } from '../imports/sheets/student-list.sheet.js';
import type {
  SourceResultRow,
  SourceStudentRow,
} from './school-source.reader.js';

export interface ReferenceMapping {
  kind: SchoolMappingKind;
  sourceCode: string;
  targetCode: string;
}

// Source code -> local code. A code without a mapping is looked up as it is; an unknown one then fails the run (D3).
export class CodeTranslator {
  private readonly byKind = new Map<SchoolMappingKind, Map<string, string>>();

  constructor(mappings: readonly ReferenceMapping[]) {
    for (const mapping of mappings) {
      const kind = this.byKind.get(mapping.kind) ?? new Map<string, string>();
      kind.set(mapping.sourceCode, mapping.targetCode);
      this.byKind.set(mapping.kind, kind);
    }
  }

  local(kind: SchoolMappingKind, sourceCode: string): string {
    return this.byKind.get(kind)?.get(sourceCode) ?? sourceCode;
  }
}

const labelOf = (labels: Record<string, string>) => {
  const byToken = new Map(Object.entries(labels).map(([label, token]) => [token, label]));
  // An unknown token passes through unchanged so the shared validator reports it.
  return (token: string) => byToken.get(token.toUpperCase()) ?? token;
};
const studentStatusLabel = labelOf(STUDENT_STATUS_TEXT);
const resultStatusLabel = labelOf(RESULT_STATUS_TEXT);

// The school rows become the same rows an Excel file produces, so one validator and one writer serve both sources.
export function toStudentRows(
  rows: readonly SourceStudentRow[],
  codes: CodeTranslator,
): SheetRow<StudentColumn>[] {
  return rows.map((row, index) => ({
    rowNumber: index + 1,
    cells: {
      studentCode: row.studentCode,
      fullName: row.fullName,
      cohortCode: codes.local('COHORT', row.cohortCode),
      major: row.major,
      programCode: codes.local('PROGRAM', row.programCode),
      admissionSemesterCode: codes.local('SEMESTER', row.admissionSemesterCode),
      statusSemesterCode: codes.local('SEMESTER', row.statusSemesterCode),
      status: studentStatusLabel(row.status),
    },
  }));
}

export function toResultRows(
  rows: readonly SourceResultRow[],
  codes: CodeTranslator,
): SheetRow<ResultColumn>[] {
  return rows.map((row, index) => ({
    rowNumber: index + 1,
    cells: {
      studentCode: row.studentCode,
      courseCode: codes.local('COURSE', row.courseCode),
      semesterCode: codes.local('SEMESTER', row.semesterCode),
      score10: row.score10 ?? '',
      score4: row.score4 ?? '',
      letterGrade: row.letterGrade ?? '',
      status: resultStatusLabel(row.status),
    },
  }));
}
