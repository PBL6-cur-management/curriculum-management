import type { PermissionMatrix } from '../api/permissionMatrix';

export const CELL_OPTIONS = [
  {
    key: 'X',
    label: 'Trực tiếp, toàn bộ',
    short: 'Toàn bộ',
    mode: 'DIRECT',
    scope: 'ALL',
  },
  {
    key: 'P',
    label: 'Trực tiếp, theo phạm vi',
    short: 'Phạm vi',
    mode: 'DIRECT',
    scope: 'SCOPED',
  },
  {
    key: 'D',
    label: 'Qua đề xuất, toàn bộ',
    short: 'Đề xuất',
    mode: 'VIA_REQUEST',
    scope: 'ALL',
  },
  {
    key: 'DP',
    label: 'Qua đề xuất, theo phạm vi',
    short: 'Đề xuất · phạm vi',
    mode: 'VIA_REQUEST',
    scope: 'SCOPED',
  },
] as const;

export type CellKey = (typeof CELL_OPTIONS)[number]['key'] | 'none';

export const NO_CELL_LABEL = 'Không có quyền';
export const NO_CELL_SHORT = '—';
export const LOCKED_REASON = 'Ô này bị khóa để luôn giữ quyền quản trị.';

export const FUNCTION_GROUP_LABELS: Record<
  PermissionMatrix['permissions'][number]['functionGroup'],
  string
> = {
  SYSTEM_ADMIN: 'Quản trị hệ thống',
  COURSE_CATALOG: 'Danh mục học phần',
  PROGRAM: 'Chương trình đào tạo',
  LEARNING_OUTCOME: 'Chuẩn đầu ra',
  SYLLABUS: 'Đề cương chi tiết',
  APPROVAL: 'Quy trình phê duyệt',
  VERSION: 'Phiên bản',
  DATA_REPORT: 'Dữ liệu và báo cáo',
  STUDENT_LOOKUP: 'Tra cứu sinh viên',
};

export function cellKeyOf(
  cell: { mode: string; scope: string } | undefined,
): CellKey {
  if (!cell) return 'none';
  return (
    CELL_OPTIONS.find(
      (option) => option.mode === cell.mode && option.scope === cell.scope,
    )?.key ?? 'none'
  );
}

export function cellLabel(key: CellKey): string {
  return key === 'none'
    ? NO_CELL_LABEL
    : CELL_OPTIONS.find((option) => option.key === key)!.label;
}
