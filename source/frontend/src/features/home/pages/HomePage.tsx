import { Flex, Typography, theme } from 'antd';
import { Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { useMe } from '../../../shared/auth/useMe';
import { APP_MENU, visibleLeaves } from '../../../shared/layout/menuItems';

const SECTIONS: { title: string; paths: string[] }[] = [
  {
    title: 'Việc cần làm',
    paths: [ROUTES.approvalQueue, ROUTES.changeRequests, ROUTES.notifications],
  },
  {
    title: 'Chương trình và học phần',
    paths: [
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

export function HomePage() {
  const { data: me } = useMe();
  const { token } = theme.useToken();
  const leaves = visibleLeaves(
    APP_MENU,
    me?.permissions ?? [],
    me?.roles.map((role) => role.roleCode) ?? [],
  );
  const roles = me?.roles.map((role) => role.roleName).join(', ');
  return (
    <Flex vertical gap={32} style={{ maxWidth: 960 }}>
      <Flex vertical gap={4}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Xin chào, {me?.fullName}
        </Typography.Title>
        {roles && <Typography.Text type="secondary">{roles}</Typography.Text>}
      </Flex>
      <Flex wrap gap={40}>
        {SECTIONS.map((section) => {
          const links = section.paths
            .map((path) => leaves.find((leaf) => leaf.path === path))
            .filter((leaf) => leaf !== undefined);
          if (!links.length) return null;
          return (
            <Flex
              key={section.title}
              vertical
              gap={10}
              style={{ minWidth: 200 }}
            >
              <Typography.Text
                strong
                style={{ color: token.colorTextSecondary }}
              >
                {section.title}
              </Typography.Text>
              {links.map((leaf) => (
                <Link key={leaf.path} to={leaf.path!}>
                  {leaf.label}
                </Link>
              ))}
            </Flex>
          );
        })}
      </Flex>
    </Flex>
  );
}
