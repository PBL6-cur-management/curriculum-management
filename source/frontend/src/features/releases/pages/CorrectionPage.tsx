import { App, Alert, Flex, Result, Skeleton, Space, Typography } from 'antd';
import { generatePath, Link, useNavigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { versionLabel } from '../../../shared/constants/versionLabels';
import { CorrectionIssueForm } from '../components/CorrectionIssueForm';
import { FrozenRowsTable } from '../components/FrozenRowsTable';
import {
  useDiscardCorrection,
  useIssueCorrection,
  useVersionDetail,
} from '../hooks/useReleases';

// MH-49 (US-076): R1 edits a correction Draft through the ordinary screens (they take the Draft's own version id),
// then issues it with a reason. Opening the page never creates a Draft: the button on the version does, once.
export function CorrectionPage() {
  const { programId = '', versionId = '', correctionId = '' } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const draft = useVersionDetail(programId, correctionId);
  const issue = useIssueCorrection(programId, versionId, correctionId);
  const discard = useDiscardCorrection(programId, versionId, correctionId);
  if (draft.isPending) return <Skeleton active />;
  if (!draft.data) {
    const refused =
      draft.error instanceof ApiError && draft.error.status === 403;
    return (
      <Result
        status={refused ? '403' : '404'}
        title={
          refused
            ? 'Chỉ Phòng Đào tạo đính chính được phiên bản.'
            : 'Không tìm thấy bản nháp đính chính (có thể đã ban hành hoặc đã hủy).'
        }
        extra={
          <Link
            to={generatePath(ROUTES.versionDetail, { programId, versionId })}
          >
            Về phiên bản
          </Link>
        }
      />
    );
  }
  const params = { programId, versionId: correctionId };
  const back = generatePath(ROUTES.versionDetail, { programId, versionId });
  return (
    <Flex vertical gap="middle">
      <Link to={back}>
        ← Phiên bản{' '}
        {versionLabel(draft.data.correctionOf ?? { versionNumber: null })}
      </Link>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Ban hành đính chính
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        title="Sửa bản nháp đính chính ở các màn hình dưới đây, rồi ban hành. Phiên bản gốc không bị sửa tại chỗ."
      />
      <Space wrap>
        <Link to={generatePath(ROUTES.programVersionInfo, params)}>
          Thông tin chương trình
        </Link>
        <Link to={generatePath(ROUTES.curriculum, params)}>
          Khung chương trình
        </Link>
        <Link to={generatePath(ROUTES.plos, params)}>PLO</Link>
        <Link to={generatePath(ROUTES.consistency, params)}>
          Kiểm tra nhất quán
        </Link>
      </Space>
      <FrozenRowsTable rows={draft.data.rows} versionId={correctionId} />
      <CorrectionIssueForm
        issuing={issue.isPending}
        discarding={discard.isPending}
        onIssue={(body) =>
          issue.mutateAsync(body).then((issued) => {
            void message.success('Đã ban hành bản đính chính.');
            void navigate(
              generatePath(ROUTES.versionDetail, {
                programId,
                versionId: issued.id,
              }),
            );
          })
        }
        onDiscard={() =>
          discard.mutateAsync().then(
            () => {
              void message.success('Đã hủy bản nháp đính chính.');
              void navigate(back);
            },
            (error: unknown) =>
              void message.error(
                error instanceof ApiError
                  ? error.message
                  : 'Không hủy được bản nháp.',
              ),
          )
        }
      />
    </Flex>
  );
}
