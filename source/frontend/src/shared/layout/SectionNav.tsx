import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'antd';
import { useLocation, useNavigate } from 'react-router';
import { ROUTES } from '../../routes';
import { PERMISSIONS, type PermissionCode } from '../auth/permissions';
import { fetchMe, meQueryKey } from '../auth/me';

interface SectionPage {
  path: string;
  label: string;
  // Shown when the caller holds any of these (none listed: everyone who reached the section).
  anyPermissions?: readonly PermissionCode[];
}

// Sibling pages that share one sidebar entry: the sidebar names the job, these tabs switch the view.
export const SECTIONS = {
  courses: [
    { path: ROUTES.courses, label: 'Danh mục học phần' },
    { path: ROUTES.equivalenceGroups, label: 'Nhóm tương đương' },
  ],
  imports: [
    { path: ROUTES.imports, label: 'Nhập dữ liệu' },
    { path: ROUTES.importHistory, label: 'Lịch sử nhập liệu' },
  ],
  graduation: [
    {
      path: ROUTES.graduation,
      label: 'Xét từng sinh viên',
      anyPermissions: ['graduation.view'],
    },
    {
      path: ROUTES.graduationBatches,
      label: 'Xét hàng loạt',
      anyPermissions: ['graduation.audit'],
    },
  ],
  approvals: [
    {
      path: ROUTES.approvalQueue,
      label: 'Chờ tôi duyệt',
      anyPermissions: [PERMISSIONS.changeRequestView],
    },
    {
      path: ROUTES.changeRequests,
      label: 'Tất cả đề xuất',
      anyPermissions: [PERMISSIONS.changeRequestView],
    },
    {
      path: ROUTES.approvalDelegations,
      label: 'Ủy quyền duyệt',
      anyPermissions: [PERMISSIONS.delegationManage],
    },
  ],
} as const satisfies Record<string, readonly SectionPage[]>;

export type SectionName = keyof typeof SECTIONS;

// The longest matching path wins, so `/imports/history` is not taken for `/imports`.
export function activeSectionPath(
  pages: readonly SectionPage[],
  pathname: string,
): string | undefined {
  return [...pages]
    .filter(
      (page) => pathname === page.path || pathname.startsWith(`${page.path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;
}

export function SectionNav({ section }: { section: SectionName }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Reads the caller the layout already loaded; the tabs never fetch it themselves.
  const { data: me } = useQuery({
    queryKey: meQueryKey,
    queryFn: fetchMe,
    staleTime: Infinity,
    enabled: false,
  });
  const permissions = me?.permissions ?? [];
  const pages = (SECTIONS[section] as readonly SectionPage[]).filter(
    (page) =>
      !page.anyPermissions ||
      page.anyPermissions.some((code) => permissions.includes(code)),
  );
  // One reachable page needs no switcher.
  if (pages.length < 2) return null;
  return (
    <Tabs
      activeKey={activeSectionPath(pages, pathname)}
      onChange={(path) => void navigate(path)}
      items={pages.map((page) => ({ key: page.path, label: page.label }))}
      style={{ marginBottom: 0 }}
    />
  );
}
