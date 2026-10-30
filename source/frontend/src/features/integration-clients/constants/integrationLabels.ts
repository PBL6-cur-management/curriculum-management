import type { IntegrationClientStatus } from '../api/integrationClients';

export const CLIENT_STATUS_LABELS: Record<IntegrationClientStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Đã khóa',
};
export const CLIENT_STATUS_COLORS: Record<IntegrationClientStatus, string> = {
  ACTIVE: 'success',
  LOCKED: 'default',
};
export const DEFAULT_RATE_PER_MINUTE = 60;
export const CLIENT_NAME_MAX = 200;
