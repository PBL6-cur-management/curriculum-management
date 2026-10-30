import { Suspense } from 'react';
import { LogoutOutlined } from '@ant-design/icons';
import { Button, Flex, Layout, Skeleton, Typography } from 'antd';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { ROUTES } from '../../../routes';
import { useLogout } from '../../../shared/auth/useLogout';
import { palette } from '../../../shared/design-system/tokens';

const HEADER_BACKGROUND = `linear-gradient(to right, ${palette.headerFrom}, ${palette.headerTo})`;

export const PORTAL_NAV = [
  { to: ROUTES.studentPortal, label: 'Tổng quan', end: true },
  { to: ROUTES.studentCurriculum, label: 'Chương trình', end: false },
  { to: ROUTES.studentProgress, label: 'Tiến độ', end: true },
  { to: ROUTES.studentRegistration, label: 'Đăng ký HP', end: true },
  { to: ROUTES.studentGraduation, label: 'Tốt nghiệp', end: true },
] as const;

// A separate, compact shell: every portal screen is one tap from this bar, and nothing in it scrolls the page sideways at 360px.
export function StudentLayout() {
  const { pathname, search } = useLocation();
  const logout = useLogout();
  return (
    <Layout style={{ minHeight: '100vh', background: palette.slate50 }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          height: 56,
          paddingInline: 16,
          background: HEADER_BACKGROUND,
          position: 'sticky',
          top: 0,
          zIndex: 60,
        }}
      >
        <Link
          to={{ pathname: ROUTES.studentPortal, search }}
          aria-label="Tổng quan"
        >
          <Flex align="center" gap={10}>
            <Flex
              align="center"
              justify="center"
              style={{
                width: 36,
                height: 36,
                background: palette.white,
                flexShrink: 0,
              }}
            >
              <img
                src="/logo-dut.webp"
                alt="Logo ĐHBK Đà Nẵng"
                width={30}
                height={30}
              />
            </Flex>
            <Typography.Text
              strong
              style={{ color: palette.white, fontSize: 15 }}
            >
              Cổng sinh viên
            </Typography.Text>
          </Flex>
        </Link>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          style={{ color: palette.white }}
          loading={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Đăng xuất
        </Button>
      </Layout.Header>
      <nav
        aria-label="Cổng sinh viên"
        style={{
          position: 'sticky',
          top: 56,
          zIndex: 50,
          background: palette.white,
          borderBottom: `1px solid ${palette.slate200}`,
          overflowX: 'auto',
        }}
      >
        <Flex
          gap={4}
          style={{ paddingInline: 8, maxWidth: 960, margin: '0 auto' }}
        >
          {PORTAL_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search }}
              end={item.end}
              style={({ isActive }) => ({
                padding: '12px 10px',
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? palette.brand : palette.slate700,
                borderBottom: `2px solid ${isActive ? palette.brand : 'transparent'}`,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </Flex>
      </nav>
      <Layout.Content
        style={{
          padding: '16px 16px 48px',
          width: '100%',
          maxWidth: 960,
          margin: '0 auto',
          minWidth: 0,
        }}
      >
        <Suspense
          key={pathname}
          fallback={
            <Skeleton active paragraph={{ rows: 6 }} aria-busy="true" />
          }
        >
          <Outlet />
        </Suspense>
      </Layout.Content>
    </Layout>
  );
}
