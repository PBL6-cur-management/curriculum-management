import {
  WARNING_SEVERITY,
  type WarningSeverity,
} from '../../../shared/curriculum/curriculum-warnings.js';
import type { FormatError } from '../sheets/sheet-reader.js';

export interface ImportIssue {
  rowNumber: number | null;
  severity: WarningSeverity;
  code: string;
  column: string | null;
  message: string;
}
export interface ImportReport {
  formatErrors: FormatError[];
  issues: ImportIssue[];
}
export interface ValidationResult<P> {
  report: ImportReport;
  totalRows: number;
  errorRows: number;
  plan: P;
}
const SEVERITY_RANK = { ERROR: 0, HIGH: 1, INFO: 2 } as const;

export function sortIssues(issues: ImportIssue[]): ImportIssue[] {
  return [...issues].sort(
    (left, right) =>
      (left.rowNumber ?? -1) - (right.rowNumber ?? -1) ||
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity],
  );
}

export class IssueCollector {
  private readonly issues: ImportIssue[] = [];
  private readonly errorRowNumbers = new Set<number>();
  private fileError = false;

  add(
    rowNumber: number | null,
    severity: WarningSeverity,
    code: string,
    message: string,
    column: string | null = null,
  ): void {
    this.issues.push({ rowNumber, severity, code, column, message });
    if (severity === WARNING_SEVERITY.ERROR) {
      if (rowNumber === null) this.fileError = true;
      else this.errorRowNumbers.add(rowNumber);
    }
  }
  hasError(rowNumber: number): boolean {
    return this.errorRowNumbers.has(rowNumber);
  }
  result<P>(
    totalRows: number,
    rowNumbers: readonly number[],
    plan: P,
  ): ValidationResult<P> {
    return {
      report: { formatErrors: [], issues: sortIssues(this.issues) },
      totalRows,
      errorRows: this.fileError
        ? totalRows
        : rowNumbers.filter((row) => this.hasError(row)).length,
      plan,
    };
  }
}
