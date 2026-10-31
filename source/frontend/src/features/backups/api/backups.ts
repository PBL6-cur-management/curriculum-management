import { getJson, withQuery } from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

type Schemas = components['schemas'];

export type BackupStatus = Schemas['BackupStatusDto'];
export type BackupState = Schemas['BackupState'];
export type BackupRun = Schemas['BackupRunDto'];
export type BackupRunStatus = Schemas['BackupRunStatus'];
export type BackupRunPage = Schemas['BackupRunPageDto'];
export type RestoreDrill = Schemas['RestoreDrillDto'];
export type RestoreDrillPage = Schemas['RestoreDrillPageDto'];
export type DrillStatus = Schemas['DrillStatus'];
export type DrillCheck = Schemas['DrillCheckDto'];
export type DrillCheckCode = Schemas['DrillCheckCode'];
export type DeliveryTier = Schemas['DeliveryTier'];
export type BackupListParams = NonNullable<
  operations['BackupsController_list']['parameters']['query']
>;
export type DrillListParams = NonNullable<
  operations['BackupsController_drills']['parameters']['query']
>;

const BASE = '/operations';

export const fetchBackupStatus = () =>
  getJson<BackupStatus>(`${BASE}/backups/status`);
export const fetchBackups = (params: BackupListParams) =>
  getJson<BackupRunPage>(withQuery(`${BASE}/backups`, { ...params }));
export const fetchRestoreDrills = (params: DrillListParams) =>
  getJson<RestoreDrillPage>(withQuery(`${BASE}/restore-drills`, { ...params }));
