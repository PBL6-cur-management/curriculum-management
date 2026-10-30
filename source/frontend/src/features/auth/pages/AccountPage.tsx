import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Input,
} from 'antd';
import type { ChangePasswordRequest } from '../api/auth';
import { useChangePassword } from '../hooks/useChangePassword';
import { NEW_PASSWORD_RULES, REQUIRED_PASSWORD } from '../schema/authRules';
import { useMe } from '../../../shared/auth/useMe';
import { PageHeader, formatEmpty } from '../../../shared/design-system';

interface ChangePasswordForm extends ChangePasswordRequest {
  confirmPassword: string;
}

export function AccountPage() {
  const { data: me } = useMe();
  const changeMutation = useChangePassword();
  const [form] = Form.useForm<ChangePasswordForm>();
  const { message } = App.useApp();
  if (!me) return null;
  const onFinish = ({ currentPassword, newPassword }: ChangePasswordForm) =>
    changeMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          form.resetFields();
          void message.success('Đã đổi mật khẩu');
        },
      },
    );
  return (
    <Flex vertical gap="large">
      <PageHeader title="Tài khoản của tôi" />
      {me.mustChangePassword && (
        <Alert
          type="warning"
          showIcon
          title="Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống."
        />
      )}
      <Card title="Thông tin tài khoản">
        <Descriptions
          bordered
          column={1}
          items={[
            { key: 'fullName', label: 'Họ tên', children: me.fullName },
            { key: 'username', label: 'Tên đăng nhập', children: me.username },
            {
              key: 'userCode',
              label: 'Mã cán bộ / sinh viên',
              children: me.userCode,
            },
            { key: 'email', label: 'Email', children: formatEmpty(me.email) },
          ]}
        />
      </Card>
      <Card title="Đổi mật khẩu">
        {changeMutation.isError && (
          <Alert type="error" showIcon title={changeMutation.error.message} />
        )}
        <Form<ChangePasswordForm>
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            name="currentPassword"
            label="Mật khẩu hiện tại"
            rules={REQUIRED_PASSWORD}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={NEW_PASSWORD_RULES}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Nhập lại mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue('newPassword')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu nhập lại không khớp')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={changeMutation.isPending}
          >
            Đổi mật khẩu
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}
