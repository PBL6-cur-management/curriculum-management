import type { components } from '../api/schema';

export type ChangeRequestStatus = components['schemas']['ChangeRequestStatus'];

// Shared because the banner on a working copy (four features) shows the status too.
export const REQUEST_STATUS_LABELS: Record<ChangeRequestStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_COORDINATOR: 'Chờ Điều phối duyệt',
  PENDING_DIRECTOR: 'Chờ Giám đốc CTĐT duyệt',
  PENDING_FACULTY_LEADERSHIP: 'Chờ Ban lãnh đạo khoa',
  PENDING_ACADEMIC_OFFICE: 'Chờ Phòng Đào tạo duyệt',
  APPROVED: 'Đã phê duyệt',
  EFFECTIVE: 'Đã có hiệu lực',
  REJECTED: 'Bị từ chối',
  WITHDRAWN: 'Đã rút',
};

export const REQUEST_STATUS_COLORS: Record<ChangeRequestStatus, string> = {
  DRAFT: 'default',
  PENDING_COORDINATOR: 'processing',
  PENDING_DIRECTOR: 'processing',
  PENDING_FACULTY_LEADERSHIP: 'purple',
  PENDING_ACADEMIC_OFFICE: 'processing',
  APPROVED: 'success',
  EFFECTIVE: 'success',
  REJECTED: 'error',
  WITHDRAWN: 'warning',
};
