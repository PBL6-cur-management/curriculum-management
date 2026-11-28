import { Flex, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { useMe } from '../../../shared/auth/useMe';
import { palette, radius } from '../../../shared/design-system/tokens';
import { APP_MENU, visibleLeaves } from '../../../shared/layout/menuItems';

const SECTIONS: { title: string; paths: string[] }[] = [
  {
    title: 'Việc cần làm',
    paths: [ROUTES.approvalQueue, ROUTES.changeRequests, ROUTES.notifications],
  },
  {
    title: 'Chương trình và học phần',
    paths: [
      ROUTES.majors,
      ROUTES.programs,
      ROUTES.courses,
      ROUTES.equivalenceGroups,
      ROUTES.semesters,
    ],
  },
  {
    title: 'Sinh viên và dữ liệu',
    paths: [
      ROUTES.students,
      ROUTES.graduationBatches,
      ROUTES.graduation,
      ROUTES.imports,
      ROUTES.importHistory,
    ],
  },
  {
    title: 'Quản trị',
    paths: [
      ROUTES.users,
      ROUTES.orgUnits,
      ROUTES.subjectGroups,
      ROUTES.permissionMatrix,
      ROUTES.health,
    ],
  },
];

interface HomeLinkRowProps {
  to: string;
  label: string;
}

function HomeLinkRow({ to, label }: HomeLinkRowProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        margin: '0 -10px',
        borderRadius: radius.md,
        background: hovered ? palette.slate50 : 'transparent',
        color: hovered ? palette.brand : palette.slate800,
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.4,
        textDecoration: 'none',
        transition:
          'background-color 140ms cubic-bezier(0.4, 0, 0.2, 1), color 140ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{
          color: hovered ? palette.brand : palette.slate400,
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        →
      </span>
    </Link>
  );
}

export function HomePage() {
  const { data: me } = useMe();
  const leaves = visibleLeaves(
    APP_MENU,
    me?.permissions ?? [],
    me?.roles.map((role) => role.roleCode) ?? [],
    me?.canApprove ?? false,
  );
  const roleNames = [...new Set(me?.roles.map((role) => role.roleName))];

  return (
    <Flex vertical gap={24} style={{ maxWidth: 1120 }}>
      <Flex vertical gap={8}>
        <Typography.Title
          level={2}
          style={{
            margin: 0,
            fontSize: 22,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            color: palette.slate800,
          }}
        >
          Xin chào, {me?.fullName}
        </Typography.Title>
        {roleNames.length > 0 && (
          <Flex wrap gap={6}>
            {roleNames.map((roleName) => (
              <span
                key={roleName}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: palette.slate100,
                  color: palette.slate700,
                  border: `1px solid ${palette.slate200}`,
                  borderRadius: radius.sm,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                {roleName}
              </span>
            ))}
          </Flex>
        )}
      </Flex>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {SECTIONS.map((section) => {
          const links = section.paths
            .map((path) => leaves.find((leaf) => leaf.path === path))
            .filter((leaf) => leaf !== undefined);
          if (!links.length) return null;
          return (
            <section
              key={section.title}
              style={{
                background: palette.white,
                border: `1px solid ${palette.slate200}`,
                borderRadius: radius.lg,
                padding: '16px 18px',
              }}
            >
              <Typography.Text
                strong
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: palette.slate600,
                  letterSpacing: '0.01em',
                  paddingBottom: 10,
                  marginBottom: 6,
                  borderBottom: `1px solid ${palette.slate200}`,
                }}
              >
                {section.title}
              </Typography.Text>
              <Flex vertical gap={2}>
                {links.map((leaf) => (
                  <HomeLinkRow
                    key={leaf.path}
                    to={leaf.path!}
                    label={leaf.label}
                  />
                ))}
              </Flex>
            </section>
          );
        })}
      </div>
    </Flex>
  );
}
