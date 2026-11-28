import { useState } from 'react';
import { App, Button, Popconfirm, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { ApiError } from '../../../shared/api/client';
import {
  formatPeriod,
  VALIDITY_STATE_COLORS,
  VALIDITY_STATE_LABELS,
} from '../../../shared/validity/validity';
import type { SubjectGroupMember } from '../api/subjectGroupAdmin';
import { EndMemberModal } from './EndMemberModal';
import {
  useDemoteCoordinator,
  usePromoteCoordinator,
  useRevokeMember,
} from '../hooks/useSubjectGroupAdmin';

interface MemberTableProps {
  groupId: string;
  rows: SubjectGroupMember[];
  canManage: boolean;
  activeCoordinatorIds?: ReadonlySet<string>;
}
export function MemberTable({
  groupId,
  rows,
  canManage,
  activeCoordinatorIds,
}: MemberTableProps) {
  const [ending, setEnding] = useState<SubjectGroupMember | null>(null);
  const { message, modal } = App.useApp();
  const revoke = useRevokeMember();
  const promote = usePromoteCoordinator();
  const demote = useDemoteCoordinator();

  async function revokeRow(row: SubjectGroupMember) {
    try {
      await revoke.mutateAsync({ groupId, memberId: row.id });
    } catch (error) {
      void message.error(
        error instanceof ApiError
          ? error.message
          : 'Không thể thu hồi dòng thành viên',
      );
    }
  }

  function confirmPromote(row: SubjectGroupMember) {
    modal.confirm({
      title: `Thăng cấp ${row.lecturer.fullName} làm Điều phối?`,
      content:
        'Giảng viên sẽ được gán vai trò Điều phối nhóm chuyên môn kể từ hôm nay.',
      okText: 'Thăng cấp Điều phối',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await promote.mutateAsync({
            groupId,
            lecturerId: row.lecturer.id,
          });
          void message.success('Đã thăng cấp Điều phối.');
        } catch (error) {
          void message.error(
            error instanceof ApiError
              ? error.message
              : 'Không thể thăng cấp Điều phối',
          );
        }
      },
    });
  }

  function confirmDemote(row: SubjectGroupMember) {
    modal.confirm({
      title: `Hạ quyền Điều phối của ${row.lecturer.fullName}?`,
      content:
        'Quyền Điều phối sẽ kết thúc hiệu lực; giảng viên vẫn giữ tư cách Thành viên nhóm.',
      okText: 'Hạ xuống Thành viên',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await demote.mutateAsync({
            groupId,
            lecturerId: row.lecturer.id,
          });
          void message.success('Đã hạ xuống Thành viên.');
        } catch (error) {
          void message.error(
            error instanceof ApiError
              ? error.message
              : 'Không thể hạ quyền Điều phối',
          );
        }
      },
    });
  }

  const columns: TableColumnsType<SubjectGroupMember> = [
    {
      title: 'Mã giảng viên',
      render: (_value, row) => (
        <>
          {row.lecturer.userCode}
          {row.lecturer.status === 'DISABLED' && <Tag>Đã vô hiệu hóa</Tag>}
        </>
      ),
    },
    { title: 'Họ tên', render: (_value, row) => row.lecturer.fullName },
    {
      title: 'Thời hạn',
      render: (_value, row) => formatPeriod(row.validFrom, row.validTo),
    },
    {
      title: 'Trạng thái',
      render: (_value, row) => (
        <Tag color={VALIDITY_STATE_COLORS[row.state]}>
          {VALIDITY_STATE_LABELS[row.state]}
        </Tag>
      ),
    },
    {
      title: 'Người gán',
      render: (_value, row) =>
        `${row.assignedBy?.fullName ?? '—'} · ${row.createdAt}`,
    },
    {
      title: 'Người thu hồi',
      render: (_value, row) =>
        row.revokedBy
          ? `${row.revokedBy.fullName} · ${row.revokedAt ?? ''}`
          : '—',
    },
    ...(canManage
      ? [
          {
            title: 'Thao tác',
            render: (_: unknown, row: SubjectGroupMember) =>
              ['ACTIVE', 'SCHEDULED'].includes(row.state) ? (
                <>
                  {row.state === 'ACTIVE' &&
                    row.memberRole === 'MEMBER' &&
                    !activeCoordinatorIds?.has(row.lecturer.id) && (
                      <Button type="link" onClick={() => confirmPromote(row)}>
                        Thăng cấp Điều phối
                      </Button>
                    )}
                  {row.state === 'ACTIVE' &&
                    row.memberRole === 'COORDINATOR' && (
                      <Button type="link" onClick={() => confirmDemote(row)}>
                        Hạ xuống Thành viên
                      </Button>
                    )}
                  <Button type="link" onClick={() => setEnding(row)}>
                    Kết thúc
                  </Button>
                  <Popconfirm
                    title="Dùng khi dòng này nhập nhầm. Lịch sử vẫn giữ dòng đã thu hồi."
                    onConfirm={() => void revokeRow(row)}
                  >
                    <Button type="link" danger>
                      Thu hồi
                    </Button>
                  </Popconfirm>
                </>
              ) : null,
          },
        ]
      : []),
  ];
  return (
    <>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={false}
      />
      <EndMemberModal
        groupId={groupId}
        row={ending}
        onClose={() => setEnding(null)}
      />
    </>
  );
}
