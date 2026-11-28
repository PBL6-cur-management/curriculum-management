import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Popconfirm, Segmented, Space, Typography } from 'antd';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { Curriculum, ProgramTrack } from '../api/curriculum';
import { useDeleteTrack } from '../hooks/useCurriculum';
import type { CurriculumTrackFilter } from '../hooks/useCurriculumFilters';

interface ProgramTrackBarProps {
  curriculum: Curriculum;
  value: CurriculumTrackFilter;
  canEdit: boolean;
  onChange: (next: CurriculumTrackFilter) => void;
  onAdd: () => void;
  onEdit: (track: ProgramTrack) => void;
}

export function ProgramTrackBar({
  curriculum,
  value,
  canEdit,
  onChange,
  onAdd,
  onEdit,
}: ProgramTrackBarProps) {
  const { message } = App.useApp();
  const remove = useDeleteTrack(curriculum.version.id);

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

  const options = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'COMMON', label: 'Khung chung' },
    ...curriculum.tracks.map((track) => ({
      value: track.id,
      label: (
        <Space size={4}>
          <span>{`${track.trackCode} — ${track.trackName}`}</span>
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

  return (
    <Flex wrap gap="small" align="center" justify="space-between">
      <Flex wrap gap="small" align="center">
        <Typography.Text strong>
          Định hướng / Chuyên ngành con:
        </Typography.Text>
        <Segmented<string>
          options={options}
          value={value}
          onChange={(next) => onChange(next)}
        />
      </Flex>
      {canEdit && (
        <Button size="small" icon={<PlusOutlined />} onClick={onAdd}>
          Thêm định hướng
        </Button>
      )}
    </Flex>
  );
}
