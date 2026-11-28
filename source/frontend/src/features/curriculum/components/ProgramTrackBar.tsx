import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Flex,
  Popconfirm,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { requestFormLink } from '../../../shared/change-requests/requestFormLink';
import { palette, radius } from '../../../shared/design-system/tokens';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { Curriculum, ProgramTrack } from '../api/curriculum';
import { useDeleteTrack } from '../hooks/useCurriculum';
import type { CurriculumTrackFilter } from '../hooks/useCurriculumFilters';

interface ProgramTrackBarProps {
  curriculum: Curriculum;
  value: CurriculumTrackFilter;
  canEdit: boolean;
  programId?: string;
  canProposeChange?: boolean;
  includeCommon?: boolean;
  onToggleIncludeCommon?: (includeCommon: boolean) => void;
  onChange: (next: CurriculumTrackFilter) => void;
  onAdd: () => void;
  onEdit: (track: ProgramTrack) => void;
  onBulkAssign?: () => void;
}

const ACTIVE_PROPOSAL_TOOLTIP =
  'Phiên bản đã ban hành chỉ có thể chỉnh sửa thông qua đề xuất thay đổi CTĐT.';

const PILL_TRANSITION =
  'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1)';

function pillStyle(active: boolean): CSSProperties {
  return {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: radius.md,
    border: `1px solid ${active ? palette.brand : palette.slate200}`,
    background: active ? palette.brandSoft : palette.slate50,
    color: active ? palette.brandStrong : palette.slate700,
    fontWeight: active ? 600 : 400,
    fontSize: 13,
    lineHeight: '20px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: PILL_TRANSITION,
  };
}

function toggleOptionStyle(active: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: 'none',
    background: active ? palette.brandSoft : 'transparent',
    color: active ? palette.brandStrong : palette.slate600,
    fontWeight: active ? 600 : 400,
    fontSize: 12,
    lineHeight: '18px',
    padding: '3px 9px',
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: PILL_TRANSITION,
  };
}

function TrackPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={pillStyle(active)}
    >
      <span>{children}</span>
      <span
        className="tabular"
        style={{
          fontSize: 12,
          fontWeight: 400,
          color: active ? palette.brandStrong : palette.slate500,
        }}
      >
        ({count})
      </span>
    </button>
  );
}

function formatTrackCreditSummary(track: ProgramTrack): string | null {
  const parts: string[] = [];
  if (track.compulsoryCredits) {
    parts.push(`BB: ${track.compulsoryCredits} TC`);
  }
  if (track.electiveCredits) {
    parts.push(`TC: ${track.electiveCredits} TC`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function ProgramTrackBar({
  curriculum,
  value,
  canEdit,
  programId,
  canProposeChange = false,
  includeCommon = true,
  onToggleIncludeCommon,
  onChange,
  onAdd,
  onEdit,
  onBulkAssign,
}: ProgramTrackBarProps) {
  const { message } = App.useApp();
  const remove = useDeleteTrack(curriculum.version.id);
  const canCreateRequest = useCan(PERMISSIONS.changeRequestCreate);
  const showPropose = Boolean(
    !canEdit && canProposeChange && programId && canCreateRequest,
  );
  const proposalUrl = programId
    ? requestFormLink({
        type: 'CURRICULUM',
        targetType: 'PROGRAM',
        targetId: programId,
      })
    : '';

  const handleDelete = (track: ProgramTrack) => {
    remove.mutate(track.id, {
      onSuccess: () => {
        void message.success(`Đã xóa định hướng ${track.trackCode}.`);
        if (value === track.id) onChange('ALL');
      },
      onError: (reason) => {
        void message.error(
          errorMessage(reason, 'Không xóa được định hướng.'),
        );
      },
    });
  };

  const containerStyle: CSSProperties = {
    background: palette.white,
    border: `1px solid ${palette.slate200}`,
    borderRadius: radius.md,
    padding: '10px 14px',
  };

  if (curriculum.tracks.length === 0) {
    return (
      <Flex
        wrap
        gap={8}
        align="center"
        justify="space-between"
        style={containerStyle}
      >
        <Flex wrap align="center" gap={8}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            Cấu trúc CTĐT gốc
          </Typography.Text>
          <Tag style={{ marginInlineEnd: 0 }}>
            Khung chung (chưa tách chuyên ngành)
          </Tag>
        </Flex>
        {canEdit ? (
          <Button size="small" icon={<PlusOutlined />} onClick={onAdd}>
            Thêm định hướng
          </Button>
        ) : showPropose ? (
          <Tooltip title={ACTIVE_PROPOSAL_TOOLTIP}>
            <Link to={proposalUrl}>
              <Button size="small">Tạo đề xuất thêm chuyên ngành</Button>
            </Link>
          </Tooltip>
        ) : null}
      </Flex>
    );
  }

  const validValue =
    value === 'ALL' ||
    value === 'COMMON' ||
    curriculum.tracks.some((track) => track.id === value)
      ? value
      : 'ALL';

  const commonCount = curriculum.items.filter(
    (item) => item.track === null,
  ).length;
  const compactTrackLabels = curriculum.tracks.length > 3;
  const selectedTrack = curriculum.tracks.find(
    (track) => track.id === validValue,
  );
  const creditSummary = selectedTrack
    ? formatTrackCreditSummary(selectedTrack)
    : null;

  return (
    <Flex vertical gap={8} style={containerStyle}>
      <Flex wrap align="center" justify="space-between" gap={8}>
        <Flex wrap align="center" gap={8}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            Cấu trúc CTĐT gốc
          </Typography.Text>
          <Tag className="tabular" style={{ marginInlineEnd: 0 }}>
            {curriculum.tracks.length} định hướng / chuyên ngành
          </Tag>
        </Flex>
        <Flex wrap align="center" gap={6}>
          {canEdit && onBulkAssign && (
            <Button size="small" icon={<SwapOutlined />} onClick={onBulkAssign}>
              Gán học phần
            </Button>
          )}
          {canEdit && (
            <Button size="small" icon={<PlusOutlined />} onClick={onAdd}>
              Thêm định hướng
            </Button>
          )}
          {showPropose && (
            <Tooltip title={ACTIVE_PROPOSAL_TOOLTIP}>
              <Link to={proposalUrl}>
                <Button size="small" type="link">
                  Đề xuất chỉnh sửa CTĐT
                </Button>
              </Link>
            </Tooltip>
          )}
        </Flex>
      </Flex>

      <Flex wrap gap={6} align="center" role="group" aria-label="Lọc theo định hướng">
        <TrackPill
          active={validValue === 'ALL'}
          onClick={() => onChange('ALL')}
          count={curriculum.items.length}
        >
          Toàn bộ CTĐT gốc
        </TrackPill>
        <TrackPill
          active={validValue === 'COMMON'}
          onClick={() => onChange('COMMON')}
          count={commonCount}
        >
          Khung chung
        </TrackPill>
        {curriculum.tracks.map((track) => {
          const tooltipTitle = track.englishName
            ? `${track.trackName} (${track.englishName})`
            : track.trackName;
          return (
            <Tooltip key={track.id} title={tooltipTitle}>
              <span>
                <TrackPill
                  active={validValue === track.id}
                  onClick={() => onChange(track.id)}
                  count={track.itemCount}
                >
                  {compactTrackLabels ? (
                    <strong>{track.trackCode}</strong>
                  ) : (
                    <>
                      <strong>{track.trackCode}</strong> · {track.trackName}
                    </>
                  )}
                </TrackPill>
              </span>
            </Tooltip>
          );
        })}
      </Flex>

      {selectedTrack && (
        <Flex
          wrap
          align="center"
          justify="space-between"
          gap={8}
          style={{
            paddingTop: 8,
            borderTop: `1px solid ${palette.slate200}`,
          }}
        >
          <Flex wrap align="center" gap={8} className="tabular">
            <Typography.Text style={{ fontSize: 13 }}>
              <Typography.Text type="secondary">Đang xem: </Typography.Text>
              <Typography.Text strong>{selectedTrack.trackName}</Typography.Text>
              {selectedTrack.englishName && (
                <Typography.Text type="secondary">
                  {' '}
                  ({selectedTrack.englishName})
                </Typography.Text>
              )}
            </Typography.Text>
            {creditSummary && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                · {creditSummary}
              </Typography.Text>
            )}
          </Flex>
          <Flex wrap align="center" gap={8}>
            {onToggleIncludeCommon && (
              <Flex
                align="center"
                gap={2}
                role="group"
                aria-label="Phạm vi hiển thị chuyên ngành"
                style={{
                  border: `1px solid ${palette.slate200}`,
                  borderRadius: radius.md,
                  padding: 2,
                  background: palette.slate50,
                }}
              >
                <button
                  type="button"
                  aria-pressed={includeCommon}
                  onClick={() => onToggleIncludeCommon(true)}
                  style={toggleOptionStyle(includeCommon)}
                >
                  Kèm khung chung
                </button>
                <button
                  type="button"
                  aria-pressed={!includeCommon}
                  onClick={() => onToggleIncludeCommon(false)}
                  style={toggleOptionStyle(!includeCommon)}
                >
                  Chỉ môn chuyên ngành
                </button>
              </Flex>
            )}
            {canEdit && (
              <Flex align="center" gap={4}>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  aria-label={`Sửa định hướng ${selectedTrack.trackCode}`}
                  onClick={() => onEdit(selectedTrack)}
                >
                  Sửa
                </Button>
                <Popconfirm
                  title={`Xóa định hướng ${selectedTrack.trackCode}?`}
                  description="Các học phần thuộc định hướng này sẽ trở về khung chung."
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(selectedTrack)}
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Xóa định hướng ${selectedTrack.trackCode}`}
                  >
                    Xóa
                  </Button>
                </Popconfirm>
              </Flex>
            )}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}
