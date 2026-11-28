import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { getJson } from '../../../shared/api/client';
import type { components } from '../../../shared/api/schema';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { requestFormLink } from '../../../shared/change-requests/requestFormLink';
import { CURRICULUM_QUERY_ROOT } from '../../../shared/curriculum/curriculumQueryRoot';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { ProgramDetail, ProgramVersionRef } from '../api/programs';

type ProgramTrackSummary = components['schemas']['ProgramTrackDto'] & {
  studentCount?: number;
};

interface ProgramTracksSectionProps {
  program: ProgramDetail;
}

// Prefer ACTIVE, then latest released (PENDING/HISTORICAL), then latest DRAFT.
function pickRepresentativeVersion(
  program: ProgramDetail,
): ProgramVersionRef | null {
  const versions = program.versions ?? [];
  const active = versions.find((v) => v.status === 'ACTIVE');
  if (active) return active;
  const released = versions.find((v) => v.status !== 'DRAFT');
  if (released) return released;
  const draft = versions.find((v) => v.status === 'DRAFT');
  if (draft) return draft;
  return program.currentVersion ?? null;
}

function formatTrackMetadata(track: ProgramTrackSummary): string[] {
  const parts: string[] = [`${track.itemCount} học phần`];
  if (Number(track.compulsoryCredits) > 0) {
    parts.push(`BB: ${track.compulsoryCredits} TC`);
  }
  if (Number(track.electiveCredits) > 0) {
    parts.push(`TC: ${track.electiveCredits} TC`);
  }
  if (typeof track.studentCount === 'number' && track.studentCount > 0) {
    parts.push(`${track.studentCount} SV`);
  }
  return parts;
}

export function ProgramTracksSection({ program }: ProgramTracksSectionProps) {
  const { token } = theme.useToken();
  const canEditCurriculum = useCan(PERMISSIONS.curriculumEdit);
  const canCreateRequest = useCan(PERMISSIONS.changeRequestCreate);
  const version = pickRepresentativeVersion(program);
  const versionId = version?.id ?? '';

  const tracksQuery = useQuery({
    queryKey: [...CURRICULUM_QUERY_ROOT, versionId, 'tracks'] as const,
    queryFn: () =>
      getJson<ProgramTrackSummary[]>(
        `/program-versions/${encodeURIComponent(versionId)}/tracks`,
      ),
    enabled: Boolean(versionId),
  });

  const curriculumUrl = version
    ? generatePath(ROUTES.curriculum, {
        programId: program.id,
        versionId: version.id,
      })
    : null;

  const requestUrl = requestFormLink({
    type: 'CURRICULUM',
    targetType: 'PROGRAM',
    targetId: program.id,
  });

  const isLockedActive = version?.status === 'ACTIVE';
  const canProposeChange =
    isLockedActive && (canCreateRequest || canEditCurriculum);

  // The empty state carries its own proposal link; avoid a duplicate in the header.
  const hasTracks = (tracksQuery.data?.length ?? 0) > 0;
  const extra = version ? (
    <Space wrap size={8}>
      {curriculumUrl && <Link to={curriculumUrl}>Mở khung chương trình</Link>}
      {canProposeChange && hasTracks && (
        <Link to={requestUrl}>
          <Button size="small">Tạo đề xuất chỉnh sửa CTĐT</Button>
        </Link>
      )}
    </Space>
  ) : undefined;

  return (
    <Card title="Định hướng / Chuyên ngành con" extra={extra}>
      {!version ? (
        <Typography.Text type="secondary">
          Chương trình chưa có phiên bản khung chương trình.
        </Typography.Text>
      ) : tracksQuery.isPending ? (
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      ) : tracksQuery.isError ? (
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            tracksQuery.error,
            'Không tải được danh sách định hướng / chuyên ngành con.',
          )}
        />
      ) : tracksQuery.data.length === 0 ? (
        <Flex wrap align="center" justify="space-between" gap="small">
          <Typography.Text type="secondary">
            Phiên bản hiện tại chưa phân tách chuyên ngành con (dùng chung toàn
            bộ khung chương trình).
          </Typography.Text>
          {version.status === 'DRAFT' && curriculumUrl ? (
            <Link to={curriculumUrl}>Khung chương trình</Link>
          ) : canProposeChange ? (
            <Link to={requestUrl}>
              <Button size="small">Tạo đề xuất chỉnh sửa CTĐT</Button>
            </Link>
          ) : curriculumUrl ? (
            <Link to={curriculumUrl}>Mở khung chương trình</Link>
          ) : null}
        </Flex>
      ) : (
        <Row gutter={[12, 12]}>
          {tracksQuery.data.map((track) => {
            const meta = formatTrackMetadata(track);
            const trackCurriculumUrl = `${curriculumUrl}?track=${encodeURIComponent(track.id)}`;
            return (
              <Col key={track.id} xs={24} sm={12} lg={8}>
                <Flex
                  vertical
                  justify="space-between"
                  gap="small"
                  style={{
                    height: '100%',
                    padding: '12px 16px',
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    backgroundColor: token.colorBgContainer,
                  }}
                >
                  <Flex vertical gap={4}>
                    <Flex align="baseline" gap={6} wrap>
                      <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>
                        {track.trackCode}
                      </Tag>
                      <Typography.Text strong>{track.trackName}</Typography.Text>
                    </Flex>
                    {track.englishName && (
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: token.fontSizeSM }}
                      >
                        {track.englishName}
                      </Typography.Text>
                    )}
                    {track.description && (
                      <Typography.Paragraph
                        type="secondary"
                        ellipsis={{ rows: 2 }}
                        style={{ marginBottom: 0, marginTop: 4 }}
                      >
                        {track.description}
                      </Typography.Paragraph>
                    )}
                  </Flex>
                  <Flex vertical gap={6}>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: token.fontSizeSM }}
                    >
                      {meta.join(' · ')}
                    </Typography.Text>
                    <div>
                      <Link to={trackCurriculumUrl}>Xem khung học phần</Link>
                    </div>
                  </Flex>
                </Flex>
              </Col>
            );
          })}
        </Row>
      )}
    </Card>
  );
}
