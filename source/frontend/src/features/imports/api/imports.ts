import {
  API_BASE_URL,
  ApiError,
  fileNameFromHeader,
  downloadFile,
  getJson,
  sendForm,
  sendJson,
  withQuery,
} from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

export type ImportType = components['schemas']['ImportType'];
export type ImportStatus = components['schemas']['ImportBatchStatus'];
export type ImportBatch = components['schemas']['ImportBatchDetailDto'];
export type ImportSummary = components['schemas']['ImportBatchSummaryDto'];
export type ImportPage = components['schemas']['ImportBatchPageDto'];
export type ImportTypeOption = components['schemas']['ImportTypeOptionDto'];
export type ImportTarget = components['schemas']['ImportTargetDto'];
export type ImportQuery = NonNullable<
  operations['ImportsController_list']['parameters']['query']
>;

export interface UploadImportInput {
  importType: ImportType;
  versionId?: string;
  file: File;
}

const batchPath = (id: string) => `/imports/${encodeURIComponent(id)}`;
export const fetchImportTypes = () =>
  getJson<ImportTypeOption[]>('/imports/types');
export const fetchImportTargets = () =>
  getJson<ImportTarget[]>('/imports/curriculum-targets');
export const fetchImports = (query: ImportQuery) =>
  getJson<ImportPage>(withQuery('/imports', query));
export const fetchImport = (id: string) => getJson<ImportBatch>(batchPath(id));
export function createImport(input: UploadImportInput) {
  const form = new FormData();
  form.append('importType', input.importType);
  if (input.versionId) form.append('versionId', input.versionId);
  form.append('file', input.file);
  return sendForm<ImportBatch>('/imports', form);
}
export const commitImport = (id: string) =>
  sendJson<ImportBatch>('POST', `${batchPath(id)}/commit`);
export const downloadTemplate = (type: ImportType) =>
  downloadFile(`/imports/templates/${type}`, 'Mau-nhap.xlsx');
export const downloadImportFile = (id: string) =>
  downloadFile(`${batchPath(id)}/file`, 'Tep-nhap.xlsx');

export const fetchStudentCredentialStatus = (id: string) =>
  getJson<components['schemas']['StudentCredentialStatusDto']>(
    `${batchPath(id)}/student-credentials`,
  );

export async function downloadStudentCredentials(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}${batchPath(id)}/student-credentials/download`,
    {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    },
  );
  if (!response.ok) {
    let body: Partial<components['schemas']['ErrorResponseDto']> | undefined;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(response.status, body);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = fileNameFromHeader(
      response.headers.get('Content-Disposition'),
      'Mat-khau-ban-dau.xlsx',
    );
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
