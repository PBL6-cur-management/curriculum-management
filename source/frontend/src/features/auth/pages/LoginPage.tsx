import type { CSSProperties } from 'react';
import { Alert, Button, Divider, Flex, Form, Input, Typography } from 'antd';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { LoginRedirectState } from '../../../shared/auth/RequireAuth';
import { useMe } from '../../../shared/auth/useMe';
import { demoLogin } from '../../../shared/config/demoFlags';
import { palette } from '../../../shared/design-system/tokens';
import { ROUTES } from '../../../routes';
import type { LoginRequest } from '../api/auth';
import { LoginShowcase } from '../components/LoginShowcase';
import styles from '../components/LoginPage.module.css';
import { useLogin } from '../hooks/useLogin';
import { REQUIRED_PASSWORD, REQUIRED_USERNAME } from '../schema/authRules';

const BRAND_VARS = {
  '--login-from': palette.headerFrom,
  '--login-to': palette.headerTo,
  '--login-on-brand': palette.white,
  '--login-ink': palette.slate800,
  '--login-muted': palette.slate500,
  '--login-fill': palette.slate200,
  '--block-general': palette.brand,
  '--block-core': palette.pass,
  '--block-major': palette.warn,
} as CSSProperties;

export function LoginPage() {
  const { data: me } = useMe();
  const loginMutation = useLogin();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginRequest>();
  const demo = demoLogin();
  const from =
    (useLocation().state as LoginRedirectState | null)?.from ?? ROUTES.home;
  if (me) return <Navigate to={from} replace />;
  const onFinish = (values: LoginRequest) =>
    loginMutation.mutate(values, {
      onSuccess: () => void navigate(from, { replace: true }),
    });
  const signInAsDemo = () => {
    if (!demo) return;
    form.setFieldsValue(demo);
    onFinish(demo);
  };
  return (
    <div className={styles.page} style={BRAND_VARS}>
      <section className={styles.brand}>
        <div className={styles.identity}>
          <span className={styles.logo}>
            <img src="/logo-dut.webp" alt="Logo Trường Đại học Bách khoa" />
          </span>
          <div>
            <p className={styles.unit}>Trường Đại học Bách khoa – ĐH Đà Nẵng</p>
            <p className={styles.appName}>Quản lý Chương trình đào tạo</p>
          </div>
        </div>
        <div className={styles.showcaseSlot}>
          <LoginShowcase />
        </div>
      </section>
      <main className={styles.formSide}>
        <div className={styles.form}>
          <Typography.Title
            level={3}
            style={{ marginTop: 0, marginBottom: 24 }}
          >
            Đăng nhập
          </Typography.Title>
          {loginMutation.isError && (
            <Alert
              type="error"
              showIcon
              title={loginMutation.error.message}
              style={{ marginBottom: 16 }}
            />
          )}
          <Form<LoginRequest>
            form={form}
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
          >
            <Form.Item
              name="username"
              label="Tên đăng nhập"
              rules={REQUIRED_USERNAME}
            >
              <Input autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={REQUIRED_PASSWORD}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loginMutation.isPending}
            >
              Đăng nhập
            </Button>
          </Form>
          {demo && (
            <>
              <Divider plain>Xem thử hệ thống</Divider>
              <Flex vertical gap={8}>
                <Typography.Text type="secondary">
                  Tài khoản demo:{' '}
                  <Typography.Text code>{demo.username}</Typography.Text> /{' '}
                  <Typography.Text code>{demo.password}</Typography.Text> (đủ
                  mọi vai trò cán bộ)
                </Typography.Text>
                <Button
                  block
                  onClick={signInAsDemo}
                  disabled={loginMutation.isPending}
                >
                  Dùng tài khoản demo
                </Button>
              </Flex>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
