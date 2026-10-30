import { getJson, sendJson, withQuery } from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

export type SyncConfiguration = components['schemas']['SyncConfigurationDto'];
export type SaveSyncConfiguration =
  components['schemas']['SaveSyncConfigurationDto'];
export type SyncConnectionTest = components['schemas']['SyncConnectionTestDto'];
export type SyncMappingSet = components['schemas']['SyncMappingSetDto'];
export type SyncMapping = components['schemas']['SyncMappingDto'];
export type SyncMappingKind = components['schemas']['SchoolMappingKind'];
export type SyncRun = components['schemas']['SyncRunDto'];
export type SyncRunPage = components['schemas']['SyncRunPageDto'];
export type SyncRunStatus = components['schemas']['SchoolSyncStatus'];
export type SyncTrigger = components['schemas']['SchoolSyncTrigger'];
export type SyncConflict = components['schemas']['SyncConflictDto'];
export type SyncConflictPage = components['schemas']['SyncConflictPageDto'];
export type SyncRunQuery = NonNullable<
  operations['SchoolSyncController_listRuns']['parameters']['query']
>;

const BASE = '/school-db-sync';
const runPath = (id: string) => `${BASE}/runs/${encodeURIComponent(id)}`;

export const fetchSyncConfiguration = () =>
  getJson<SyncConfiguration>(`${BASE}/configuration`);
export const saveSyncConfiguration = (body: SaveSyncConfiguration) =>
  sendJson<SyncConfiguration>('PUT', `${BASE}/configuration`, body);
export const testSyncConnection = (configurationRevision: number) =>
  sendJson<SyncConnectionTest>('POST', `${BASE}/connection-test`, {
    configurationRevision,
  });
export const fetchSyncMappings = () =>
  getJson<SyncMappingSet>(`${BASE}/mappings`);
export const saveSyncMappings = (revision: number, items: SyncMapping[]) =>
  sendJson<SyncMappingSet>('PUT', `${BASE}/mappings`, { revision, items });
export const startSyncRun = (requestId: string) =>
  sendJson<SyncRun>('POST', `${BASE}/runs`, { requestId });
export const retrySyncRun = (runId: string, requestId: string) =>
  sendJson<SyncRun>('POST', `${runPath(runId)}/retry`, { requestId });
export const fetchSyncRuns = (query: SyncRunQuery) =>
  getJson<SyncRunPage>(withQuery(`${BASE}/runs`, query));
export const fetchSyncRun = (runId: string) => getJson<SyncRun>(runPath(runId));
export const fetchSyncConflicts = (
  runId: string,
  page: number,
  pageSize: number,
) =>
  getJson<SyncConflictPage>(
    withQuery(`${runPath(runId)}/conflicts`, { page, pageSize }),
  );
