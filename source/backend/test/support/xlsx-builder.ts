import type request from 'supertest';
import { setTimeout as delay } from 'node:timers/promises';
import { ImportBatchStatus } from '../../src/generated/prisma/client.js';
import type { ImportBatchDetailDto } from '../../src/features/imports/dto/import-response.dto.js';
import {
  COURSE_CATALOG_SHEET,
  type CatalogColumnKey,
} from '../../src/features/imports/sheets/course-catalog.sheet.js';
import {
  CURRICULUM_SHEET,
  type CurriculumColumnKey,
  type ProgramHeaderKey,
} from '../../src/features/imports/sheets/curriculum.sheet.js';
import { writeSheet } from '../../src/features/imports/sheets/sheet-writer.js';

export const IMPORT_E2E_BUDGET_MS = 30_000;
const IMPORT_TEST_TIMEOUT_MS = 60_000;
const IMPORT_TEST_POLL_MS = 50;
type TestAgent = ReturnType<typeof request.agent>;

export async function catalogXlsx(
  rows: Partial<Record<CatalogColumnKey, string>>[],
): Promise<Buffer> {
  return Buffer.from(await writeSheet(COURSE_CATALOG_SHEET, {}, rows));
}

export async function curriculumXlsx(
  header: Partial<Record<ProgramHeaderKey, string>>,
  rows: Partial<Record<CurriculumColumnKey, string>>[],
): Promise<Buffer> {
  return Buffer.from(await writeSheet(CURRICULUM_SHEET, header, rows));
}

export async function waitForBatch(
  agent: TestAgent,
  batchId: string,
  until: readonly ImportBatchStatus[] = [
    ImportBatchStatus.DRY_RUN,
    ImportBatchStatus.ABORTED,
  ],
  timeoutMs = IMPORT_TEST_TIMEOUT_MS,
): Promise<ImportBatchDetailDto> {
  const deadline = performance.now() + timeoutMs;
  let lastStatus: ImportBatchStatus | undefined;
  do {
    const response = await agent.get(`/api/imports/${batchId}`).expect(200);
    const batch: ImportBatchDetailDto = response.body;
    lastStatus = batch.status;
    if (until.includes(batch.status)) return batch;
    if (
      batch.status === ImportBatchStatus.ABORTED ||
      batch.status === ImportBatchStatus.COMMITTED
    )
      throw new Error(
        `Import ${batchId} ended unexpectedly: ${JSON.stringify(batch)}`,
      );
    await delay(IMPORT_TEST_POLL_MS);
  } while (performance.now() < deadline);
  throw new Error(
    `Import ${batchId} timed out after ${timeoutMs} ms; last status: ${lastStatus}`,
  );
}
