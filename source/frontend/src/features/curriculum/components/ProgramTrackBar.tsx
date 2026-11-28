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
  Segmented,
  Space,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { Link } from 'react-router';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { requestFormLink } from '../../../shared/change-requests/requestFormLink';
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
  onChange: (next: CurriculumTrackFilter) => void;
  onAdd: () => void;
  onEdit: (track: ProgramTrack) => void;
  onBulkAssign?: () => void;
}

const ACTIVE_PROPOSAL_TOOLTIP =
  'Phiên bản đã ban hành chỉ có thể chỉnh sửa thông qua đề xuất thay đổi CTĐT.';

export function ProgramTrackBar({
  curriculum,
  value,
  canEdit,
  programId,
  canProposeChange = false,
  onChange,
  onAdd,
  onEdit,
  onBulkAssign,
}: ProgramTrackBarProps) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
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

  if (curriculum.tracks.length === 0) {
    return (
      <Flex
        wrap
        gap="small"
        align="center"
        justify="space-between"
        style={{
          padding: '8px 12px',
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          backgroundColor: token.colorFillAlter,
        }}
      >
        <Space wrap size={8}>
          <Typography.Text strong>
            Định hướng / Chuyên ngành con:
          </Typography.Text>
          <Typography.Text type="secondary">
            Chưa phân tách chuyên ngành (khung chung)
          </Typography.Text>
        </Space>
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

  const options = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'COMMON', label: 'Khung chung' },
    ...curriculum.tracks.map((track) => ({
      value: track.id,
      label: (
        <Space size={4}>
          <span>{`${track.trackCode} — ${track.trackName}`}</span>
          <Typography.Text type="secondary">({track.itemCount})</Typography.Text>
          {canEdit && (
            <>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={`Sửa định hướng ${track.trackCode}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(track);
                }}
              />
              <Popconfirm
                title={`Xóa định hướng ${track.trackCode}?`}
                description="Các học phần thuộc định hướng này sẽ trở về khung chung."
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                onConfirm={(event) => {
                  event?.stopPropagation();
                  handleDelete(track);
                }}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`Xóa định hướng ${track.trackCode}`}
                  onClick={(event) => event.stopPropagation()}
                />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    })),
  ];

  const validValue =
    value === 'ALL' ||
    value === 'COMMON' ||
    curriculum.tracks.some((track) => track.id === value)
      ? value
      : 'ALL';

  return (
    <Flex wrap gap="small" align="center" justify="space-between">
      <Flex wrap gap="small" align="center">
        <Typography.Text strong>
          Định hướng / Chuyên ngành con:
        </Typography.Text>
        <Segmented<string>
          options={options}
          value={validValue}
          onChange={(next) => onChange(next)}
        />
      </Flex>
      <Space wrap size={8}>
        {canEdit && onBulkAssign && (
          <Button size="small" icon={<SwapOutlined />} onClick={onBulkAssign}>
            Gán học phần vào chuyên ngành
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
      </Space>
    </Flex>
  );
}
