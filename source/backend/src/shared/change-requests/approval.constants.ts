import { ChangeRequestStatus } from '../../generated/prisma/client.js';

export const APPROVAL_LEVEL = {
  COORDINATOR: 1,
  DIRECTOR: 2,
  ACADEMIC_OFFICE: 3,
} as const;
export type ApprovalLevel =
  (typeof APPROVAL_LEVEL)[keyof typeof APPROVAL_LEVEL];

export const APPROVAL_LEVEL_NAMES: Record<ApprovalLevel, string> = {
  1: 'Điều phối nhóm chuyên môn',
  2: 'Giám đốc CTĐT',
  3: 'Phòng Đào tạo',
};

export const PENDING_STATUS_BY_LEVEL: Record<
  ApprovalLevel,
  ChangeRequestStatus
> = {
  1: ChangeRequestStatus.PENDING_COORDINATOR,
  2: ChangeRequestStatus.PENDING_DIRECTOR,
  3: ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
};

export const PENDING_STATUSES: readonly ChangeRequestStatus[] = Object.values(
  PENDING_STATUS_BY_LEVEL,
);

export const SKIP_REASONS = {
  CREATOR: 'Người duyệt là người tạo đề xuất',
  NO_GROUP: 'Học phần chưa thuộc nhóm chuyên môn nào',
  NO_COORDINATOR: 'Nhóm chuyên môn chưa có Điều phối',
  NO_COURSE: 'Đề xuất không thay đổi học phần nào',
  FOREIGN_COURSE: 'Không áp dụng — học phần của khoa khác',
  NO_PROGRAM: 'Học phần chưa thuộc chương trình đào tạo nào',
  NO_DIRECTOR: 'Chương trình chưa có Giám đốc CTĐT',
} as const;

export const REMARK_MIN = 20;
export const REMARK_MAX = 2000;
export const COMMENT_MAX = 2000;

export const APPROVAL_STEP_KIND = {
  NORMAL: 'NORMAL',
  SKIPPED: 'SKIPPED',
  OVERRIDE: 'OVERRIDE',
  DELEGATED: 'DELEGATED',
} as const;
export type ApprovalStepKind =
  (typeof APPROVAL_STEP_KIND)[keyof typeof APPROVAL_STEP_KIND];
export const APPROVAL_STEP_KINDS = Object.values(APPROVAL_STEP_KIND);
