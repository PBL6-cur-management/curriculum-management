import {
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  DatabaseOutlined,
  HomeOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
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
  // Other pages that belong to this leaf (its section tabs), selected with it.
  also?: readonly string[];
  // A group open on arrival whatever the page: the two core jobs stay one click away.
  defaultOpen?: boolean;
  // Top level only: one glyph per entry so the eye finds a group without reading.
  icon?: ReactNode;
  children?: readonly AppMenuItem[];
}

// R6: students see their program through the portal (F-20), not the school-wide list (US-018 AC3).
export const STUDENT_ROLE_CODE = 'R6';

export const APP_MENU: readonly AppMenuItem[] = [
  // Hai việc chính lên đầu: chương trình đào tạo và đề xuất/phê duyệt. Việc phụ gom vào nhóm bên dưới.
  { path: ROUTES.home, label: 'Trang chính', icon: <HomeOutlined /> },
  {
    path: ROUTES.notifications,
    label: 'Thông báo',
    icon: <BellOutlined />,
  },
  {
    label: 'Chương trình đào tạo',
    icon: <BookOutlined />,
    defaultOpen: true,
    children: [
      {
        path: ROUTES.programs,
        label: 'Danh sách chương trình',
        permission: PERMISSIONS.programView,
        hideForRoles: [STUDENT_ROLE_CODE],
      },
      {
        // Nhóm tương đương là một tab của trang học phần.
        path: ROUTES.courses,
        label: 'Học phần',
        permission: PERMISSIONS.courseView,
        also: [ROUTES.equivalenceGroups],
      },
      {
        path: ROUTES.semesters,
        label: 'Học kỳ và khóa tuyển sinh',
        permission: PERMISSIONS.semesterManage,
      },
    ],
  },
  {
    label: 'Đề xuất và phê duyệt',
    icon: <AuditOutlined />,
    defaultOpen: true,
    children: [
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
        path: ROUTES.approvalDelegations,
        label: 'Ủy quyền duyệt',
        permission: PERMISSIONS.delegationManage,
      },
    ],
  },
  {
    label: 'Sinh viên',
    icon: <TeamOutlined />,
    children: [
      {
        path: ROUTES.students,
        label: 'Hồ sơ sinh viên',
        permission: 'student.viewProgress',
        hideForRoles: ['R2', 'R4', 'R5', 'R6'],
      },
      {
        // Xét từng sinh viên và xét hàng loạt là hai tab của cùng một trang.
        path: ROUTES.graduation,
        label: 'Xét tốt nghiệp',
        anyPermissions: ['graduation.view', 'graduation.audit'],
        hideForRoles: ['R2', 'R4', 'R5', 'R6'],
      },
    ],
  },
  {
    label: 'Báo cáo',
    icon: <BarChartOutlined />,
    children: [
      {
        path: ROUTES.reportComparison,
        label: 'So sánh chương trình',
        permission: PERMISSIONS.reportBenchmark,
      },
      {
        path: ROUTES.reportCredits,
        label: 'Phân bổ tín chỉ',
        permission: PERMISSIONS.reportBenchmark,
      },
      {
        path: ROUTES.reportAccreditation,
        label: 'Hồ sơ kiểm định',
        permission: PERMISSIONS.reportExportAccreditation,
      },
      {
        path: ROUTES.reportStatistics,
        label: 'Thống kê đề xuất',
        permission: PERMISSIONS.changeRequestStatistics,
      },
    ],
  },
  {
    label: 'Dữ liệu và tích hợp',
    icon: <DatabaseOutlined />,
    children: [
      {
        // Lịch sử nhập liệu là một tab của trang nhập liệu.
        path: ROUTES.imports,
        label: 'Nhập liệu Excel',
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
        path: ROUTES.integrationClients,
        label: 'Bên tích hợp dDUT',
        permission: PERMISSIONS.integrationClientManage,
      },
    ],
  },
  {
    label: 'Quản trị',
    icon: <SettingOutlined />,
    children: [
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
      {
        path: ROUTES.orgUnits,
        label: 'Đơn vị',
        permission: PERMISSIONS.orgUnitManage,
      },
      {
        path: ROUTES.subjectGroups,
        label: 'Nhóm chuyên môn',
        permission: PERMISSIONS.subjectGroupView,
      },
      {
        path: ROUTES.backups,
        label: 'Sao lưu và phục hồi',
        permission: PERMISSIONS.backupView,
      },
      { path: ROUTES.health, label: 'Trạng thái hệ thống' },
    ],
  },
];

type MenuEntry =
  | { key: string; label: React.ReactNode; icon?: ReactNode }
  | { key: string; label: string; icon?: ReactNode; children: MenuEntry[] };

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
            icon: item.icon,
            children: toMenuItems(item.children, permissions, roleCodes),
          }
        : {
            key: item.path ?? item.label,
            icon: item.icon,
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
  const under = (path: string) =>
    pathname === path ||
    (path !== ROUTES.home && pathname.startsWith(`${path}/`));
  return (
    leaves(items).find(
      (item) =>
        item.path !== undefined &&
        [item.path, ...(item.also ?? [])].some(under),
    )?.path ?? pathname
  );
}

// The core groups plus the group that holds the selected leaf, so its submenu is open on arrival.
export function openMenuGroups(
  items: readonly AppMenuItem[],
  selectedPath: string,
): string[] {
  return items
    .filter((item) =>
      item.children
        ? item.defaultOpen ||
          leaves(item.children).some((leaf) => leaf.path === selectedPath)
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
