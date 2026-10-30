import { useRef, useState } from 'react';
import { Alert, App, Button, Space, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../shared/api/client';
import { useMe } from '../../../shared/auth/useMe';
import { downloadStudentCredentials } from '../api/imports';
import {
  IMPORT_QUERY_KEYS,
  useStudentCredentialStatus,
} from '../hooks/useImports';

interface StudentCredentialDownloadProps {
  batchId: string;
  committed: boolean;
}
export function StudentCredentialDownload({
  batchId,
  committed,
}: StudentCredentialDownloadProps) {
  const { data: me } = useMe();
  const authorized = Boolean(
    me?.roles.some((role) => role.roleCode === 'R1') &&
    me.permissions.includes('data.importExcel'),
  );
  const status = useStudentCredentialStatus(batchId, committed && authorized);
  const client = useQueryClient();
  const { modal } = App.useApp();
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<string | null>(null);
  if (!committed || !authorized) return null;
  return (
    <Space orientation="vertical">
      {status.isError ? (
        <Alert
          type="error"
          title="Không tải được trạng thái tệp mật khẩu ban đầu."
          action={
            <Button onClick={() => void status.refetch()}>Thử lại</Button>
          }
        />
      ) : status.data?.available ? (
        <>
          <Typography.Text>
            {status.data.accountCount} tài khoản · Hết hạn:{' '}
            {status.data.expiresAt ?? '—'}
          </Typography.Text>
          <Button
            loading={pending}
            disabled={pending}
            onClick={() => {
              if (locked.current) return;
              locked.current = true;
              setPending(true);
              modal.confirm({
                title: 'Tải mật khẩu ban đầu (một lần)',
                content:
                  'Tệp chứa mật khẩu ban đầu. Chỉ tải được một lần; hãy bảo quản và phát qua kênh an toàn.',
                okText: 'Tải tệp mật khẩu',
                cancelText: 'Hủy',
                onOk: async () => {
                  setError(null);
                  try {
                    await downloadStudentCredentials(batchId);
                  } catch (caught) {
                    setError(
                      caught instanceof ApiError && caught.status === 410
                        ? 'Tệp đã hết hạn hoặc đã được tải. Hãy vào Tài khoản để đặt lại mật khẩu khi cần.'
                        : 'Không tải được tệp mật khẩu. Kiểm tra trạng thái trước khi thử lại; tệp có thể đã được sử dụng.',
                    );
                  } finally {
                    await client.invalidateQueries({
                      queryKey: IMPORT_QUERY_KEYS.credentials(batchId),
                    });
                  }
                },
                afterClose: () => {
                  locked.current = false;
                  setPending(false);
                },
              });
            }}
          >
            Tải mật khẩu ban đầu (một lần)
          </Button>
        </>
      ) : (
        status.isSuccess && (
          <Typography.Text>
            Tệp mật khẩu ban đầu không còn khả dụng hoặc lần nhập không tạo tài
            khoản mới. Khi cần, đặt lại mật khẩu tại Tài khoản.
          </Typography.Text>
        )
      )}
      {error && <Alert type="warning" showIcon title={error} />}
    </Space>
  );
}
