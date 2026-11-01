import type { ReactNode } from 'react';
import { Alert, Card, Flex, Tag, Typography } from 'antd';
import { isComingSoon, type ComingSoonFeature } from '../config/demoFlags';
import { PageHeader } from '../design-system/PageHeader';

interface ComingSoonCopy {
  title: string;
  does: string[];
  why: string;
}

// What each feature does and why the public demo does not switch it on (it needs the school's systems).
export const COMING_SOON_COPY: Record<ComingSoonFeature, ComingSoonCopy> = {
  'school-sync': {
    title: 'Đồng bộ CSDL Trường',
    does: [
      'Định kỳ đọc danh sách sinh viên, lớp và kết quả học tập từ cơ sở dữ liệu đào tạo của Trường.',
      'Ghi lại từng lần đồng bộ: số dòng thêm, sửa, bỏ qua và lỗi.',
    ],
    why: 'Cần quyền đọc và kết nối mạng tới máy chủ CSDL của Trường.',
  },
  'integration-clients': {
    title: 'Bên tích hợp dDUT',
    does: [
      'Cấp khóa API cho hệ thống dDUT đọc chương trình đào tạo và tiến độ của sinh viên.',
      'Ghi nhật ký mọi lần gọi để đối soát.',
    ],
    why: 'Cần Trường cấp và giữ khóa cho hệ thống dDUT thật.',
  },
  'email-reminders': {
    title: 'Gửi email nhắc việc',
    does: [
      'Gửi email khi có đề xuất chờ duyệt, bị trả lại hoặc sắp quá hạn.',
      'Thông báo trong hệ thống vẫn hoạt động bình thường.',
    ],
    why: 'Cần máy chủ thư (SMTP) và địa chỉ gửi chính thức của Trường.',
  },
  backups: {
    title: 'Sao lưu và phục hồi',
    does: [
      'Sao lưu cơ sở dữ liệu và tệp đính kèm mỗi đêm, giữ theo lịch.',
      'Phục hồi về một bản sao lưu đã chọn.',
    ],
    why: 'Bản demo chạy trên máy chủ thử nghiệm, không có ổ lưu trữ riêng cho bản sao lưu.',
  },
};

export function ComingSoonTag() {
  return <Tag style={{ marginInlineStart: 8 }}>Sắp có</Tag>;
}

interface ComingSoonPageProps {
  feature: ComingSoonFeature;
}

export function ComingSoonPage({ feature }: ComingSoonPageProps) {
  const copy = COMING_SOON_COPY[feature];
  return (
    <>
      <PageHeader
        title={
          <Flex align="center" wrap>
            {copy.title}
            <ComingSoonTag />
          </Flex>
        }
        subtitle="Tính năng đã có trong hệ thống nhưng chưa bật trên bản demo."
      />
      <Card style={{ maxWidth: 720 }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          Tính năng này làm gì
        </Typography.Title>
        <ul style={{ marginTop: 0, paddingInlineStart: 20 }}>
          {copy.does.map((line) => (
            <li key={line}>
              <Typography.Text>{line}</Typography.Text>
            </li>
          ))}
        </ul>
        <Typography.Title level={5}>Vì sao chưa bật</Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {copy.why}
        </Typography.Paragraph>
      </Card>
    </>
  );
}

interface ComingSoonGateProps {
  feature: ComingSoonFeature;
  children: ReactNode;
}

// Route wrapper: the real page normally, the description page when the demo build marks it "Sắp có".
export function ComingSoonGate({ feature, children }: ComingSoonGateProps) {
  return isComingSoon(feature) ? (
    <ComingSoonPage feature={feature} />
  ) : (
    children
  );
}

// Email reminders have no page of their own; the two pages that would send them carry this note instead.
export function EmailRemindersNotice() {
  if (!isComingSoon('email-reminders')) return null;
  return (
    <Alert
      type="info"
      showIcon
      title="Gửi email nhắc việc: Sắp có"
      description={COMING_SOON_COPY['email-reminders'].why}
      style={{ marginBottom: 16 }}
    />
  );
}
