import { Alert, App, Button, Card, Flex, Typography } from 'antd';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { FilterBar, PageHeader } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { downloadAccreditation, downloadMatrices } from '../api/reports';
import { VersionPicker } from '../components/VersionPicker';

type Kind = 'matrices' | 'accreditation';
const GRADING_UNAVAILABLE = 'REPORT_GRADING_UNAVAILABLE';

const DOSSIER_SHEETS =
  'Thông tin chung, khung CTĐT, PLO, ma trận học phần–PLO và CLO–PLO, phân bổ tín chỉ, đề cương, đánh giá, danh sách lỗ hổng.';

// The courses a refused dossier names, from the error details.
function missingCourses(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.code !== GRADING_UNAVAILABLE)
    return [];
  return (error.details ?? []).map((detail) => detail.field);
}

// MH-62 — US-107/US-108: matrices and the generic accreditation workbook for one released version.
export default function AccreditationExportPage() {
  const { message } = App.useApp();
  const [pick, setPick] = useState({ programId: '', versionId: '' });
  const [busy, setBusy] = useState<Kind | null>(null);
  const [refused, setRefused] = useState<{
    message: string;
    courses: string[];
  } | null>(null);

  const run = async (kind: Kind) => {
    setBusy(kind);
    setRefused(null);
    try {
      await (kind === 'matrices' ? downloadMatrices : downloadAccreditation)(
        pick.versionId,
      );
      message.success('Đã tải file.');
    } catch (error) {
      const courses = missingCourses(error);
      if (courses.length)
        setRefused({
          message: errorMessage(error, 'Chưa lập được hồ sơ.'),
          courses,
        });
      else message.error(errorMessage(error, 'Không tải được file.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Xuất hồ sơ kiểm định"
        subtitle="Ma trận chuẩn đầu ra và bộ hồ sơ tổng quát cho một phiên bản đã ban hành."
      />
      <FilterBar>
        <VersionPicker
          label="Chương trình"
          issuedOnly
          {...pick}
          onChange={(next) => {
            setPick(next);
            setRefused(null);
          }}
        />
      </FilterBar>
      {refused ? (
        <Alert
          type="warning"
          showIcon
          title={refused.message}
          description={`Học phần cần bổ sung: ${refused.courses.join(', ')}`}
        />
      ) : null}
      <Flex gap="middle" wrap>
        <Card title="Ma trận chuẩn đầu ra" style={{ flex: '1 1 320px' }}>
          <Flex vertical gap="small" align="start">
            <Typography.Text type="secondary">
              Hai trang: học phần–PLO (mức đóng góp) và CLO–PLO, đúng số liệu
              đang lưu.
            </Typography.Text>
            <Button
              disabled={!pick.versionId}
              loading={busy === 'matrices'}
              onClick={() => void run('matrices')}
            >
              Tải ma trận
            </Button>
          </Flex>
        </Card>
        <Card title="Hồ sơ kiểm định" style={{ flex: '1 1 320px' }}>
          <Flex vertical gap="small" align="start">
            <Typography.Text type="secondary">{DOSSIER_SHEETS}</Typography.Text>
            <Typography.Text type="secondary">
              Mẫu tổng quát — chưa phải biểu mẫu chính thức. Hồ sơ không được
              lập khi còn học phần thiếu đề cương ban hành hoặc thành phần đánh
              giá.
            </Typography.Text>
            <Button
              type="primary"
              disabled={!pick.versionId}
              loading={busy === 'accreditation'}
              onClick={() => void run('accreditation')}
            >
              Tải hồ sơ
            </Button>
          </Flex>
        </Card>
      </Flex>
    </Flex>
  );
}
