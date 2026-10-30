import { Alert, Button, Result } from 'antd';
import { ApiError } from '../../../shared/api/client';

interface GraduationErrorProps {
  error: Error;
  onRetry?: () => void;
}
export function GraduationError({ error, onRetry }: GraduationErrorProps) {
  if (error instanceof ApiError && [401, 403, 404].includes(error.status))
    return (
      <Result
        status={error.status === 404 ? '404' : '403'}
        title={
          error.status === 404
            ? 'Không tìm thấy hồ sơ trong chương trình và học kỳ đã chọn'
            : 'Phiên đăng nhập hoặc quyền xét tốt nghiệp không còn hợp lệ'
        }
        subTitle="Kiểm tra lại tài khoản, chương trình và học kỳ trước khi tiếp tục."
      />
    );
  return (
    <Alert
      type="error"
      showIcon
      title="Không tải được dữ liệu xét tốt nghiệp"
      description={
        error instanceof ApiError
          ? `${error.code ?? 'REQUEST_FAILED'} — ${error.message}`
          : 'Kết nối bị gián đoạn. Kiểm tra kết nối rồi thử lại; thao tác trước có thể đã được ghi nhận.'
      }
      action={onRetry && <Button onClick={onRetry}>Thử lại</Button>}
    />
  );
}
