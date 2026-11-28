import { App, Button, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { compareDecimals } from '../../../shared/decimal/decimal';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { Curriculum, ElectiveGroup } from '../api/curriculum';
import {
  GROUP_BELOW_MINIMUM_LABEL,
  GROUP_DELETE_CONFIRM,
} from '../constants/curriculumLabels';
import { useDeleteGroup } from '../hooks/useCurriculum';

interface ElectiveGroupTableProps {
  curriculum: Curriculum;
  onEdit: (group: ElectiveGroup) => void;
  onAssign: (group: ElectiveGroup) => void;
  // Group to highlight, from the consistency result's `focus` parameter.
  focusId?: string | null;
}

export const groupElementId = (groupId: string) => `elective-group-${groupId}`;

function minimumText(group: ElectiveGroup): string {
  return [
    group.minCredits !== null && `${group.minCredits} TC`,
    group.minCourses !== null && `${group.minCourses} HP`,
  ]
    .filter(Boolean)
    .join(' và ');
}

// Display only: the blocking check is the consistency check of F-08. Decimal compare, since 2.5 + 3.5 must equal 6.
export function isBelowMinimum(group: ElectiveGroup): boolean {
  return (
    (group.minCredits !== null &&
      compareDecimals(group.listedCredits, group.minCredits) < 0) ||
    (group.minCourses !== null && group.itemCount < group.minCourses)
  );
}

export function ElectiveGroupTable({
  curriculum,
  onEdit,
  onAssign,
  focusId,
}: ElectiveGroupTableProps) {
  const { message } = App.useApp();
  const remove = useDeleteGroup(curriculum.version.id);
  const itemsById = new Map(curriculum.items.map((item) => [item.id, item]));
  const tracksById = new Map(
    curriculum.tracks.map((track) => [track.id, track]),
  );
  const columns: TableColumnsType<ElectiveGroup> = [
    { title: 'Mã nhóm', dataIndex: 'groupCode' },
    { title: 'Tên nhóm', dataIndex: 'groupName' },
    {
      title: 'Định hướng',
      render: (_value, group) => {
        if (!group.trackId)
          return <Typography.Text type="secondary">Khung chung</Typography.Text>;
        const track = tracksById.get(group.trackId);
        return track ? (
          <Tooltip title={track.trackName}>
            <Tag color="geekblue">{track.trackCode}</Tag>
          </Tooltip>
        ) : (
          <Tag color="geekblue">{group.trackId}</Tag>
        );
      },
    },
    {
      title: 'Yêu cầu tối thiểu',
      render: (_value, group) => minimumText(group),
    },
    {
      title: 'Tín chỉ đã liệt kê',
      align: 'right',
      render: (_value, group) => (
        <Space>
          {group.listedCredits}
          {isBelowMinimum(group) && (
            <Tag color="warning">{GROUP_BELOW_MINIMUM_LABEL}</Tag>
          )}
        </Space>
      ),
    },
    { title: 'Số HP', dataIndex: 'itemCount', align: 'right' },
    ...(curriculum.canEditStructure
      ? [
          {
            title: 'Thao tác',
            render: (_value: unknown, group: ElectiveGroup) => (
              <Space size={0} wrap>
                <Button type="link" size="small" onClick={() => onEdit(group)}>
                  Sửa
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => onAssign(group)}
                >
                  Chọn học phần
                </Button>
                <Popconfirm
                  title={`Xóa nhóm ${group.groupCode}?`}
                  description={GROUP_DELETE_CONFIRM}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() =>
                    remove.mutateAsync(group.id).catch((reason: unknown) => {
                      void message.error(
                        errorMessage(reason, 'Không xóa được nhóm.'),
                      );
                    })
                  }
                >
                  <Button type="link" danger size="small">
                    Xóa
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];
  return (
    <Table<ElectiveGroup>
      size="small"
      rowKey="id"
      pagination={false}
      columns={columns}
      dataSource={curriculum.electiveGroups}
      locale={{ emptyText: 'Chưa có nhóm tự chọn' }}
      rowClassName={(group) =>
        group.id === focusId ? 'ant-table-row-selected' : ''
      }
      onRow={(group) => ({ id: groupElementId(group.id) })}
      expandable={{
        rowExpandable: (group) => group.itemIds.length > 0,
        expandedRowRender: (group) => (
          <ul>
            {group.itemIds.map((itemId) => {
              const item = itemsById.get(itemId);
              return (
                item && (
                  <li key={itemId}>
                    {item.course.courseCode} — {item.course.courseName} (
                    {item.course.credits} TC, học kỳ {item.plannedSemester})
                  </li>
                )
              );
            })}
          </ul>
        ),
      }}
    />
  );
}
