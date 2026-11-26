import { Alert, App, Button, Card, Flex, Typography } from 'antd';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { FilterBar, PageHeader } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { useProgram } from '../../programs/hooks/usePrograms';
import { downloadAccreditation, downloadMatrices } from '../api/reports';
import { VersionPicker } from '../components/VersionPicker';

type Kind = 'matrices' | 'accreditation';
const GRADING_UNAVAILABLE = 'REPORT_GRADING_UNAVAILABLE';
const CURRICULUM_EMPTY = 'REPORT_CURRICULUM_EMPTY';

const DOSSIER_SHEETS =
  'Thông tin chung, khung CTĐT, PLO, ma trận học phần–PLO và CLO–PLO, phân bổ tín chỉ, đề cương, đánh giá, danh sách lỗ hổng.';

// MH-62 — US-107/US-108: standalone matrices and the generic dossier for an issued version.
export default function AccreditationExportPage() {
  const { message } = App.useApp();
  const [pick, setPick] = useState({ programId: '', versionId: '' });
  const [busy, setBusy] = useState<Kind | null>(null);
  const [refused, setRefused] = useState<{
    versionId: string;
    message: string;
    courses: string[];
  } | null>(null);
  const { data: program } = useProgram(pick.programId);
  const version = program?.versions.find((item) => item.id === pick.versionId);
  const visibleRefusal = refused?.versionId === pick.versionId ? refused : null;

  const run = async (kind: Kind) => {
    if (!version) return;
    setBusy(kind);
    setRefused(null);
    try {
      await (kind === 'matrices' ? downloadMatrices : downloadAccreditation)(
        version.id,
      );
      message.success('Đã tải file.');
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === GRADING_UNAVAILABLE || error.code === CURRICULUM_EMPTY)
      )
        setRefused({
          versionId: version.id,
          message: error.message,
          courses: (error.details ?? []).map((detail) => detail.field),
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
        subtitle="Xuất ma trận chuẩn đầu ra hoặc lập hồ sơ kiểm định cho phiên bản đã ban hành."
      />
      <FilterBar>
        <VersionPicker
          label="Chương trình"
          {...pick}
          onChange={(next) => {
            setPick(next);
            setRefused(null);
          }}
        />
      </FilterBar>
      {visibleRefusal ? (
        <Alert
          type="warning"
          showIcon
          title={visibleRefusal.message}
          description={
            visibleRefusal.courses.length > 0
              ? `Học phần cần bổ sung: ${visibleRefusal.courses.join(', ')}`
              : undefined
          }
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
              disabled={!version || busy !== null}
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
            {version?.status === 'DRAFT' ? (
              <Typography.Text type="secondary">
                Chọn phiên bản đã ban hành để tải hồ sơ.
              </Typography.Text>
            ) : null}
            <Button
              type="primary"
              disabled={!version || version.status === 'DRAFT' || busy !== null}
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
