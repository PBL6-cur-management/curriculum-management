import { App, Button, Flex, Result, Skeleton, Space, Typography } from 'antd';
import { generatePath, Link, useNavigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { versionLabel } from '../../../shared/constants/versionLabels';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { FrozenRowsTable } from '../components/FrozenRowsTable';
import { VersionHeader } from '../components/VersionHeader';
import { VersionStatusTag } from '../components/VersionStatusTag';
import { useOpenCorrection, useVersionDetail } from '../hooks/useReleases';

// MH-47: an issued version, read-only for everyone (R1 included): the only way to change it is a request or a correction.
export function VersionDetailPage() {
  const { programId = '', versionId = '' } = useParams();
  const {
    data: version,
    isPending,
    error,
  } = useVersionDetail(programId, versionId);
  const canViewOutcomes = useCan(PERMISSIONS.outcomeView);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const openCorrection = useOpenCorrection(programId, versionId);
  if (isPending) return <Skeleton active />;
  if (!version) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <Result status="403" title="Bạn không có quyền xem phiên bản này" />
      );
    return <Result status="404" title="Không tìm thấy phiên bản" />;
  }
  const params = { programId, versionId };
  const startCorrection = () =>
    openCorrection.mutate(undefined, {
      onSuccess: (draft) =>
        void navigate(
          generatePath(ROUTES.versionCorrection, {
            programId,
            versionId,
            correctionId: draft.id,
          }),
        ),
      onError: (reason) =>
        void message.error(
          errorMessage(reason, 'Không mở được bản đính chính.'),
        ),
    });
  return (
    <Flex vertical gap="middle">
      <Link to={generatePath(ROUTES.versionHistory, { programId })}>
        ← Lịch sử phiên bản {version.programCode}
      </Link>
      <Flex justify="space-between" align="center" wrap gap="small">
        <Typography.Title level={2} style={{ margin: 0 }}>
          {version.programCode} — {version.programName} · phiên bản{' '}
          {versionLabel(version)} <VersionStatusTag status={version.status} />
        </Typography.Title>
        <Space wrap>
          {version.openCorrection && (
            <Link
              to={generatePath(ROUTES.versionCorrection, {
                programId,
                versionId,
                correctionId: version.openCorrection.id,
              })}
            >
              Tiếp tục bản đính chính đang soạn
            </Link>
          )}
          {version.canCorrect && !version.openCorrection && (
            <Button
              loading={openCorrection.isPending}
              onClick={startCorrection}
            >
              Đính chính
            </Button>
          )}
        </Space>
      </Flex>
      <VersionHeader version={version} />
      <Typography.Text type="secondary">
        {version.majorCode} — {version.majorName} · {version.semesterCount} học
        kỳ · tổng {version.totalCredits} tín chỉ (bắt buộc{' '}
        {version.compulsoryCredits}, tự chọn {version.electiveCredits})
      </Typography.Text>
      <Space wrap>
        <Link to={generatePath(ROUTES.curriculum, params)}>
          Khung chương trình
        </Link>
        <Link to={generatePath(ROUTES.consistency, params)}>
          Kiểm tra nhất quán
        </Link>
        <Link to={generatePath(ROUTES.electiveGroups, params)}>
          Nhóm tự chọn
        </Link>
        {canViewOutcomes && (
          <>
            <Link to={generatePath(ROUTES.plos, params)}>PLO</Link>
            <Link to={generatePath(ROUTES.coursePloMatrix, params)}>
              Ma trận học phần–PLO
            </Link>
            <Link to={generatePath(ROUTES.cloPloMatrix, params)}>
              Ma trận CLO–PLO
            </Link>
          </>
        )}
      </Space>
      <FrozenRowsTable rows={version.rows} versionId={versionId} />
    </Flex>
  );
}
