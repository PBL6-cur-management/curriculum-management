import { Suspense, useEffect } from 'react';
import { DownOutlined, UserOutlined } from '@ant-design/icons';
import {
  Button,
  Dropdown,
  Flex,
  Layout,
  Menu,
  Skeleton,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation } from 'react-router';
import { useMe } from '../auth/useMe';
import { useLogout } from '../auth/useLogout';
import { NotificationBell } from '../notifications/NotificationBell';
import { palette } from '../design-system/tokens';
import { ROUTES } from '../../routes';
import { rememberLocation } from './navigationMemory';
import {
  APP_MENU,
  openMenuGroups,
  selectedMenuPath,
  toMenuItems,
} from './menuItems';

const HEADER_BACKGROUND = `linear-gradient(to right, ${palette.headerFrom}, ${palette.headerTo})`;

export function AppLayout() {
  const { pathname, search } = useLocation();
  // Back links return to the list as the user left it (filters, page).
  useEffect(() => rememberLocation(pathname, search), [pathname, search]);
  const { data: me } = useMe();
  const logoutMutation = useLogout();
  const selectedPath = selectedMenuPath(APP_MENU, pathname);
  const userMenu: MenuProps['items'] = [
    {
      key: ROUTES.account,
      label: <Link to={ROUTES.account}>Tài khoản của tôi</Link>,
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Đăng xuất',
      onClick: () => logoutMutation.mutate(),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          background: HEADER_BACKGROUND,
          boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.18)',
          position: 'sticky',
          top: 0,
          zIndex: 60,
        }}
      >
        <Link to={ROUTES.home} aria-label="Trang chính">
          <Flex align="center" gap={12}>
            <Flex
              align="center"
              justify="center"
              style={{
                width: 44,
                height: 44,
                background: palette.white,
                flexShrink: 0,
              }}
            >
              <img
                src="/logo-dut.webp"
                alt="Logo ĐHBK Đà Nẵng"
                width={36}
                height={36}
              />
            </Flex>
            <Flex vertical style={{ lineHeight: 1.25 }}>
              <Typography.Text
                style={{ color: palette.white, fontSize: 12, opacity: 0.85 }}
              >
                Trường Đại học Bách khoa · Khoa Công nghệ Thông tin
              </Typography.Text>
              <Typography.Text
                strong
                style={{ color: palette.white, fontSize: 16 }}
              >
                Quản lý Chương trình đào tạo
              </Typography.Text>
            </Flex>
          </Flex>
        </Link>
        <Flex align="center" gap={4}>
          <NotificationBell />
          <Dropdown menu={{ items: userMenu }} trigger={['click']}>
            <Button type="text" style={{ color: palette.white }}>
              <UserOutlined />
              {me?.fullName}
              <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
        </Flex>
      </Layout.Header>
      <Layout>
        <Layout.Sider
          breakpoint="lg"
          collapsedWidth={0}
          width={248}
          theme="light"
          style={{
            borderRight: `1px solid ${palette.slate200}`,
            position: 'sticky',
            top: 64,
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedPath]}
            defaultOpenKeys={openMenuGroups(APP_MENU, selectedPath)}
            style={{ borderInlineEnd: 'none', paddingBlock: 12 }}
            items={toMenuItems(
              APP_MENU,
              me?.permissions ?? [],
              me?.roles.map((role) => role.roleCode) ?? [],
              me?.canApprove ?? false,
            )}
          />
        </Layout.Sider>
        <Layout.Content style={{ padding: '24px 32px 48px', minWidth: 0 }}>
          {/* key theo pathname: mỗi trang có Suspense riêng, không thay cả layout bằng spinner. */}
          <Suspense key={pathname} fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

function PageSkeleton() {
  return (
    <Flex vertical gap={24} aria-busy="true">
      <Skeleton.Input active style={{ width: 280, height: 28 }} />
      <Skeleton active paragraph={{ rows: 8 }} title={false} />
    </Flex>
  );
}
