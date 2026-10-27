import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import {
  ImportBatchStatus,
  ImportType,
} from '../../generated/prisma/client.js';
import { IMPORT_JOB, IMPORT_LIMITS, XLSX_MIME } from './import.constants.js';
import {
  fromReportJson,
  jobOptions,
  sendXlsx,
  toDetailDto,
  toReportJson,
  toSummaryDto,
  type BatchDetailRow,
} from './import-mapping.js';

function row(): BatchDetailRow {
  return {
    id: 'batch',
    importType: ImportType.CURRICULUM,
    fileName: 'khung.xlsx',
    performedById: 'u',
    performedBy: { id: 'u', fullName: 'Người nhập' },
    versionId: 'v',
    version: { programName: 'Tên phiên bản' },
    program: {
      id: 'p',
      programCode: 'CT01',
      versions: [{ programName: 'Tên hiện tại' }],
    },
    status: ImportBatchStatus.DRY_RUN,
    totalRows: 1,
    errorRows: 0,
    successRows: 1,
    recordedAt: new Date('2026-10-26T00:00:00Z'),
    finishedAt: null,
    file: { expiresAt: new Date('2100-01-01') },
    errorReport: { formatErrors: [], issues: [] },
  };
}
describe('import mapping', () => {
  it('maps only public fields and uses the batch version name before the fallback', () => {
    const value = row();
    expect(toSummaryDto(value)).toMatchObject({
      program: { programName: 'Tên phiên bản' },
      recordedAt: '2026-10-26T00:00:00.000Z',
      finishedAt: null,
    });
    expect(toSummaryDto(value)).not.toHaveProperty('performedById');
    value.version = null;
    expect(toSummaryDto(value).program?.programName).toBe('Tên hiện tại');
    value.program = null;
    expect(toSummaryDto(value).program).toBeNull();
  });
  it('allows commit only by the owner with a clean report and an unexpired file', () => {
    expect(toDetailDto(row(), 'u').canCommit).toBe(true);
    expect(toDetailDto(row(), 'other').canCommit).toBe(false);
    const value = row();
    value.file = null;
    expect(toDetailDto(value, 'u').canCommit).toBe(false);
    value.file = { expiresAt: new Date(0) };
    expect(toDetailDto(value, 'u').fileAvailable).toBe(false);
    value.file = row().file;
    value.errorRows = 1;
    expect(toDetailDto(value, 'u').canCommit).toBe(false);
    value.errorRows = 0;
    value.errorReport = {
      formatErrors: [{ column: 'Mã HP', message: 'Thiếu' }],
      issues: [],
    };
    expect(toDetailDto(value, 'u').canCommit).toBe(false);
  });
  it('round-trips the stored report in one centralized mapping boundary', () => {
    const report = { formatErrors: [], issues: [] };
    expect(toReportJson(report)).toEqual(report);
    expect(fromReportJson(report)).toEqual(report);
    expect(fromReportJson(null)).toBeNull();
  });
  it('uses deduplicated colon-free jobs and bounded retry settings', () => {
    expect(jobOptions(IMPORT_JOB.COMMIT, 'batch')).toMatchObject({
      jobId: 'commit-batch',
      attempts: IMPORT_LIMITS.JOB_ATTEMPTS,
      removeOnComplete: true,
      backoff: { type: 'exponential', delay: IMPORT_LIMITS.JOB_BACKOFF_MS },
    });
  });
  it('uses the shared RFC 5987 file sender', () => {
    const set = vi.fn();
    const bytes = new Uint8Array([1, 2]);
    const stream = sendXlsx(
      { set } as unknown as Response,
      bytes,
      'Khung tiếng Việt.xlsx',
    );
    expect(stream.getStream()).toBeDefined();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': XLSX_MIME,
        'Content-Disposition': expect.stringContaining(
          "filename*=UTF-8''Khung%20ti%E1%BA%BFng%20Vi%E1%BB%87t.xlsx",
        ),
      }),
    );
  });
});
