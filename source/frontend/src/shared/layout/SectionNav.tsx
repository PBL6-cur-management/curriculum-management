import { useQuery } from '@tanstack/react-query';
import { Flex } from 'antd';
import { useLocation, useNavigate } from 'react-router';
import { ROUTES } from '../../routes';
import type { PermissionCode } from '../auth/permissions';
import { fetchMe, meQueryKey } from '../auth/me';
import { palette, radius } from '../design-system/tokens';

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
  const activePath = activeSectionPath(pages, pathname);
  return (
    <Flex
      role="tablist"
      wrap
      gap={6}
      style={{
        background: palette.slate100,
        padding: 3,
        borderRadius: radius.lg,
        width: 'fit-content',
      }}
    >
      {pages.map((page) => {
        const isActive = page.path === activePath;
        return (
          <button
            key={page.path}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => void navigate(page.path)}
            style={{
              appearance: 'none',
              background: isActive ? palette.white : 'transparent',
              color: isActive ? palette.brand : palette.slate600,
              fontWeight: isActive ? 600 : 500,
              fontSize: 14,
              lineHeight: 1.4,
              padding: '5px 12px',
              borderRadius: radius.md,
              border: isActive
                ? `1px solid ${palette.slate200}`
                : '1px solid transparent',
              cursor: 'pointer',
              transition:
                'background-color 140ms cubic-bezier(0.4, 0, 0.2, 1), color 140ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {page.label}
          </button>
        );
      })}
    </Flex>
  );
}
