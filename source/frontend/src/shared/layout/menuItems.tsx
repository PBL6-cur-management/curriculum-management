import { Link } from 'react-router';
import { ROUTES } from '../../routes';
import { prefetchRoute } from './prefetchRoute';
import { PERMISSIONS, type PermissionCode } from '../auth/permissions';

// A leaf has a `path`; a group has `children` and no path of its own.
export interface AppMenuItem {
  path?: string;
  label: string;
  permission?: PermissionCode;
  anyPermissions?: readonly PermissionCode[];
  // Hidden when every role the caller holds is listed (display only; the server refuses anyway).
  hideForRoles?: readonly string[];
  children?: readonly AppMenuItem[];
}

// R6: students see their program through the portal (F-20), not the school-wide list (US-018 AC3).
export const STUDENT_ROLE_CODE = 'R6';

export const APP_MENU: readonly AppMenuItem[] = [
  // Việc hằng ngày trước, danh mục ở giữa, quản trị cuối.
  { path: ROUTES.home, label: 'Trang chính' },
  { path: ROUTES.notifications, label: 'Thông báo' },
  {
    path: ROUTES.approvalQueue,
    label: 'Chờ tôi duyệt',
    permission: PERMISSIONS.changeRequestView,
  },
  {
    path: ROUTES.changeRequests,
    label: 'Đề xuất thay đổi',
    permission: PERMISSIONS.changeRequestView,
  },
  {
    path: ROUTES.programs,
    label: 'Chương trình đào tạo',
    permission: PERMISSIONS.programView,
    hideForRoles: [STUDENT_ROLE_CODE],
  },
  {
    label: 'Học phần',
    children: [
      {
        path: ROUTES.courses,
        label: 'Danh mục học phần',
        permission: PERMISSIONS.courseView,
      },
      {
        path: ROUTES.equivalenceGroups,
        label: 'Nhóm tương đương',
        permission: PERMISSIONS.courseView,
      },
    ],
  },
  {
    path: ROUTES.semesters,
    label: 'Học kỳ và khóa tuyển sinh',
    permission: PERMISSIONS.semesterManage,
  },
  {
    path: ROUTES.students,
    label: 'Sinh viên',
    permission: 'student.viewProgress',
    hideForRoles: ['R2', 'R4', 'R5', 'R6'],
  },
  {
    label: 'Xét tốt nghiệp',
    children: [
      {
        path: ROUTES.graduationBatches,
        label: 'Xét hàng loạt',
        permission: 'graduation.audit',
        hideForRoles: ['R2', 'R4', 'R5', 'R6'],
      },
      {
        path: ROUTES.graduation,
        label: 'Xét từng sinh viên',
        permission: 'graduation.view',
        hideForRoles: ['R2', 'R4', 'R5', 'R6'],
      },
    ],
  },
  {
    path: ROUTES.imports,
    label: 'Nhập liệu',
    anyPermissions: [
      PERMISSIONS.curriculumImportExportExcel,
      PERMISSIONS.dataImportExcel,
    ],
  },
  {
    path: ROUTES.importHistory,
    label: 'Lịch sử nhập liệu',
    anyPermissions: [
      PERMISSIONS.curriculumImportExportExcel,
      PERMISSIONS.dataImportExcel,
    ],
  },
  {
    path: ROUTES.schoolSync,
    label: 'Đồng bộ CSDL Trường',
    permission: PERMISSIONS.syncConfigure,
  },
  {
    path: ROUTES.subjectGroups,
    label: 'Nhóm chuyên môn',
    permission: PERMISSIONS.subjectGroupView,
  },
  {
    path: ROUTES.orgUnits,
    label: 'Đơn vị',
    permission: PERMISSIONS.orgUnitManage,
  },
  {
    path: ROUTES.users,
    label: 'Tài khoản',
    permission: PERMISSIONS.userManage,
  },
  {
    path: ROUTES.permissionMatrix,
    label: 'Ma trận quyền',
    permission: PERMISSIONS.permissionView,
  },
  { path: ROUTES.health, label: 'Trạng thái hệ thống' },
];

type MenuEntry =
  | { key: string; label: React.ReactNode }
  | { key: string; label: string; children: MenuEntry[] };

const groupKey = (item: AppMenuItem) => `group:${item.label}`;

function isHiddenForRoles(
  item: AppMenuItem,
  roleCodes: readonly string[],
): boolean {
  return (
    item.hideForRoles !== undefined &&
    roleCodes.length > 0 &&
    roleCodes.every((roleCode) => item.hideForRoles?.includes(roleCode))
  );
}

function isVisible(
  item: AppMenuItem,
  permissions: readonly PermissionCode[],
  roleCodes: readonly string[],
): boolean {
  if (isHiddenForRoles(item, roleCodes)) return false;
  if (
    item.anyPermissions &&
    !item.anyPermissions.some((code) => permissions.includes(code))
  )
    return false;
  return item.children
    ? item.children.some((child) => isVisible(child, permissions, roleCodes))
    : !item.permission || permissions.includes(item.permission);
}

export function toMenuItems(
  items: readonly AppMenuItem[],
  permissions: readonly PermissionCode[],
  roleCodes: readonly string[] = [],
): MenuEntry[] {
  return items
    .filter((item) => isVisible(item, permissions, roleCodes))
    .map((item) =>
      item.children
        ? {
            key: groupKey(item),
            label: item.label,
            children: toMenuItems(item.children, permissions, roleCodes),
          }
        : {
            key: item.path ?? item.label,
            label: (
              <Link
                to={item.path ?? ROUTES.home}
                onMouseEnter={() => item.path && prefetchRoute(item.path)}
                onFocus={() => item.path && prefetchRoute(item.path)}
              >
                {item.label}
              </Link>
            ),
          },
    );
}

function leaves(items: readonly AppMenuItem[]): AppMenuItem[] {
  return items.flatMap((item) =>
    item.children ? leaves(item.children) : item,
  );
}

// The leaf whose path is the current page or the page's parent (`/courses/c1` selects `/courses`).
export function selectedMenuPath(
  items: readonly AppMenuItem[],
  pathname: string,
): string {
  return (
    leaves(items).find(
      (item) =>
        item.path !== undefined &&
        (pathname === item.path ||
          (item.path !== ROUTES.home && pathname.startsWith(`${item.path}/`))),
    )?.path ?? pathname
  );
}

// Groups that contain the selected leaf, so the submenu is open on arrival.
export function openMenuGroups(
  items: readonly AppMenuItem[],
  selectedPath: string,
): string[] {
  return items
    .filter((item) =>
      item.children
        ? leaves(item.children).some((leaf) => leaf.path === selectedPath)
        : false,
    )
    .map(groupKey);
}

// Các trang người dùng mở được, phẳng hóa (dùng cho lối tắt ở trang chính).
export function visibleLeaves(
  items: readonly AppMenuItem[],
  permissions: readonly PermissionCode[],
  roleCodes: readonly string[] = [],
): AppMenuItem[] {
  return items
    .filter((item) => isVisible(item, permissions, roleCodes))
    .flatMap((item) =>
      item.children
        ? visibleLeaves(item.children, permissions, roleCodes)
        : [item],
    );
}
