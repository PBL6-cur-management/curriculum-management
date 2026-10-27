import type { JobsOptions } from 'bullmq';
import type { Response } from 'express';
import { ImportBatchStatus, Prisma } from '../../generated/prisma/client.js';
import { USER_REF_SELECT } from '../../shared/dtos/ref.dto.js';
import { sendFile } from '../../shared/files/send-file.js';
import {
  DAY_SECONDS,
  IMPORT_LIMITS,
  XLSX_MIME,
  type ImportJobName,
} from './import.constants.js';
import type {
  ImportBatchSummaryDto,
  ImportBatchDetailDto,
} from './dto/import-response.dto.js';
import type { ImportReport } from './validation/import-report.js';

export const BATCH_SUMMARY_SELECT = {
  id: true,
  importType: true,
  fileName: true,
  performedById: true,
  performedBy: { select: USER_REF_SELECT },
  versionId: true,
  version: { select: { programName: true } },
  program: {
    select: {
      id: true,
      programCode: true,
      versions: {
        where: { sourceRequestId: null, correctionOfId: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { programName: true },
      },
    },
  },
  status: true,
  totalRows: true,
  successRows: true,
  errorRows: true,
  recordedAt: true,
  finishedAt: true,
} as const satisfies Prisma.ImportBatchSelect;
export const BATCH_DETAIL_SELECT = {
  ...BATCH_SUMMARY_SELECT,
  errorReport: true,
  file: { select: { expiresAt: true } },
} as const satisfies Prisma.ImportBatchSelect;
export type BatchSummaryRow = Prisma.ImportBatchGetPayload<{
  select: typeof BATCH_SUMMARY_SELECT;
}>;
export type BatchDetailRow = Prisma.ImportBatchGetPayload<{
  select: typeof BATCH_DETAIL_SELECT;
}>;

export function toSummaryDto(row: BatchSummaryRow): ImportBatchSummaryDto {
  return {
    id: row.id,
    importType: row.importType,
    fileName: row.fileName,
    performedBy: row.performedBy,
    versionId: row.versionId,
    program: row.program
      ? {
          id: row.program.id,
          programCode: row.program.programCode,
          programName:
            row.version?.programName ??
            row.program.versions[0]?.programName ??
            row.program.programCode,
        }
      : null,
    status: row.status,
    totalRows: row.totalRows,
    successRows: row.successRows,
    errorRows: row.errorRows,
    recordedAt: row.recordedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
export function toDetailDto(
  row: BatchDetailRow,
  userId: string,
  now = new Date(),
): ImportBatchDetailDto {
  const report = fromReportJson(row.errorReport);
  const fileAvailable = row.file !== null && row.file.expiresAt > now;
  return {
    ...toSummaryDto(row),
    report,
    fileAvailable,
    canCommit:
      row.status === ImportBatchStatus.DRY_RUN &&
      row.performedById === userId &&
      row.errorRows === 0 &&
      !report?.formatErrors.length &&
      !report?.issues.some((issue) => issue.severity === 'ERROR') &&
      fileAvailable,
  };
}
export function toReportJson(report: ImportReport): Prisma.InputJsonValue {
  return report as unknown as Prisma.InputJsonValue;
}
export function fromReportJson(
  value: Prisma.JsonValue | null,
): ImportReport | null {
  return value as unknown as ImportReport | null;
}
export function sendXlsx(res: Response, content: Uint8Array, fileName: string) {
  return sendFile(res, content, fileName, XLSX_MIME);
}
export function jobOptions(name: ImportJobName, batchId: string): JobsOptions {
  return {
    jobId: `${name}-${batchId}`,
    attempts: IMPORT_LIMITS.JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: IMPORT_LIMITS.JOB_BACKOFF_MS },
    removeOnComplete: true,
    removeOnFail: { age: IMPORT_LIMITS.FILE_RETENTION_DAYS * DAY_SECONDS },
  };
}
