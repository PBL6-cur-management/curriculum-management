import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchBackups,
  fetchBackupStatus,
  fetchRestoreDrills,
  type BackupListParams,
  type DrillListParams,
} from '../api/backups';
import { BACKUP_POLL_INTERVAL_MS } from '../constants/backupLabels';

export const BACKUP_QUERY_ROOT = ['backups'] as const;
export const BACKUP_QUERY_KEYS = {
  status: [...BACKUP_QUERY_ROOT, 'status'] as const,
  list: (params: BackupListParams) =>
    [...BACKUP_QUERY_ROOT, 'list', params] as const,
  drills: (params: DrillListParams) =>
    [...BACKUP_QUERY_ROOT, 'drills', params] as const,
};

// Passive polling only while the tab is visible; the pages never start, prune or restore anything.
const POLLING = {
  refetchInterval: BACKUP_POLL_INTERVAL_MS,
  refetchIntervalInBackground: false,
} as const;

export function useBackupStatus() {
  return useQuery({
    queryKey: BACKUP_QUERY_KEYS.status,
    queryFn: fetchBackupStatus,
    ...POLLING,
  });
}

export function useBackups(params: BackupListParams) {
  return useQuery({
    queryKey: BACKUP_QUERY_KEYS.list(params),
    queryFn: () => fetchBackups(params),
    placeholderData: keepPreviousData,
    ...POLLING,
  });
}

export function useRestoreDrills(params: DrillListParams) {
  return useQuery({
    queryKey: BACKUP_QUERY_KEYS.drills(params),
    queryFn: () => fetchRestoreDrills(params),
    placeholderData: keepPreviousData,
    ...POLLING,
  });
}
