import {
  downloadFile,
  getJson,
  sendJson,
  withQuery,
} from '../../../shared/api/client';
import type { components } from '../../../shared/api/schema';
import type {
  GraduationAudit,
  GraduationAuditPage,
  GraduationBatch,
  GraduationBatchCreate,
  GraduationBatchFilter,
  GraduationBatchPage,
  GraduationExportFilters,
  GraduationItemPage,
  GraduationItemQuery,
  GraduationLookup,
  GraduationOutcome,
  GraduationPage,
  GraduationPreview,
  GraduationProgram,
  GraduationStudentPage,
  GraduationStudentQuery,
  GraduationTask,
  GraduationTaskPage,
} from '../schema/graduation';
export type * from '../schema/graduation';

const studentPath = (id: string) => `/students/${encodeURIComponent(id)}`;
const batchPath = (id: string) =>
  `/graduation-batches/${encodeURIComponent(id)}`;
const context = (lookup: GraduationLookup) => ({
  programId: lookup.programId,
  semesterId: lookup.semesterId,
});

export function fetchGraduation(
  lookup: GraduationLookup,
): Promise<GraduationOutcome> {
  return getJson(
    withQuery(`${studentPath(lookup.studentId)}/graduation`, context(lookup)),
  );
}
export function saveGraduation(
  lookup: GraduationLookup,
  requestKey: string,
): Promise<GraduationAudit> {
  const body = {
    ...context(lookup),
    requestKey,
  } satisfies components['schemas']['GraduationSaveDto'];
  return sendJson(
    'POST',
    `${studentPath(lookup.studentId)}/graduation-audits`,
    body,
  );
}
export function fetchGraduationHistory(
  lookup: GraduationLookup,
  page: GraduationPage,
): Promise<GraduationAuditPage> {
  return getJson(
    withQuery(`${studentPath(lookup.studentId)}/graduation-audits`, {
      ...context(lookup),
      ...page,
    }),
  );
}
export function fetchGraduationAudit(id: string): Promise<GraduationAudit> {
  return getJson(`/graduation-audits/${encodeURIComponent(id)}`);
}
export function fetchGraduationPrograms(
  semesterId: string,
): Promise<GraduationProgram[]> {
  return getJson(withQuery('/graduation/program-options', { semesterId }));
}
export function fetchGraduationStudents(
  query: GraduationStudentQuery,
): Promise<GraduationStudentPage> {
  return getJson(withQuery('/graduation/student-options', query));
}
export function fetchGraduationTasks(
  lookup: GraduationLookup,
  page: GraduationPage,
): Promise<GraduationTaskPage> {
  return getJson(
    withQuery(`${studentPath(lookup.studentId)}/graduation-reaudit-tasks`, {
      ...context(lookup),
      ...page,
    }),
  );
}
export function retryGraduationTask(id: string): Promise<GraduationTask> {
  return sendJson(
    'POST',
    `/graduation-reaudit-tasks/${encodeURIComponent(id)}/retry`,
  );
}
export function previewGraduationBatch(
  input: GraduationBatchFilter,
): Promise<GraduationPreview> {
  return sendJson('POST', '/graduation-batches/preview', input);
}
export function createGraduationBatch(
  input: GraduationBatchCreate,
): Promise<GraduationBatch> {
  return sendJson('POST', '/graduation-batches', input);
}
export function fetchGraduationBatches(
  page: GraduationPage,
): Promise<GraduationBatchPage> {
  return getJson(withQuery('/graduation-batches', page));
}
export function fetchGraduationBatch(id: string): Promise<GraduationBatch> {
  return getJson(batchPath(id));
}
export function fetchGraduationItems(
  id: string,
  query: GraduationItemQuery,
): Promise<GraduationItemPage> {
  return getJson(withQuery(`${batchPath(id)}/items`, query));
}
export function downloadGraduationBatch(
  id: string,
  filters: GraduationExportFilters,
): Promise<void> {
  return downloadFile(
    withQuery(`${batchPath(id)}/export`, filters),
    `xet-tot-nghiep-${id}.xlsx`,
  );
}
