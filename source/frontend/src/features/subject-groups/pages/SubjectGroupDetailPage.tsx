import { useState } from 'react';
import { Alert, Button, Card, Flex, Result, Tag, Typography } from 'antd';
import { useParams } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { useCan } from '../../../shared/auth/useCan';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import type { SubjectGroupMember } from '../api/subjectGroupAdmin';
import { AddMemberModal } from '../components/AddMemberModal';
import { MemberTable } from '../components/MemberTable';
import { useSubjectGroup } from '../hooks/useSubjectGroupAdmin';
import {
  GROUP_STATUS_COLORS,
  GROUP_STATUS_LABELS,
  NO_COORDINATOR_LABEL,
} from '../constants/subjectGroupLabels';
import { PageSkeleton } from '../../../shared/design-system';

export function SubjectGroupDetailPage() {
  const { groupId = '' } = useParams();
  const canManage = useCan(PERMISSIONS.orgUnitManage);
  const { data: group, isPending, error } = useSubjectGroup(groupId);
  const [showHistory, setShowHistory] = useState(false);
  const [memberRole, setMemberRole] = useState<
    SubjectGroupMember['memberRole'] | null
  >(null);
  if (isPending) return <PageSkeleton />;
  if (!group) {
    if (error instanceof ApiError && error.status === 403)
      return <Result status="403" title="Nhóm này nằm ngoài phạm vi của bạn" />;
    return <Result status="404" title="Không tìm thấy nhóm chuyên môn" />;
  }
  const visibleRows = showHistory
    ? group.members
    : group.members.filter(
        (row) => row.state === 'ACTIVE' || row.state === 'SCHEDULED',
      );
  return (
    <Flex vertical gap="middle">
      <Card
        title={
          <>
            {group.groupName}{' '}
            <Typography.Text type="secondary">
              ({group.groupCode})
            </Typography.Text>{' '}
            <Tag color={GROUP_STATUS_COLORS[group.status]}>
              {GROUP_STATUS_LABELS[group.status]}
            </Tag>
          </>
        }
      >
        <Typography.Paragraph>{group.faculty.unitName}</Typography.Paragraph>
        {group.status === 'ACTIVE' && !group.hasActiveCoordinator && (
          <Alert type="warning" title={NO_COORDINATOR_LABEL} />
        )}
        {canManage && group.status === 'ACTIVE' && (
          <Flex gap={8}>
            <Button onClick={() => setMemberRole('MEMBER')}>
              Thêm thành viên
            </Button>
            <Button onClick={() => setMemberRole('COORDINATOR')}>
              Chỉ định Điều phối
            </Button>
          </Flex>
        )}
      </Card>
      <label>
        <input
          type="checkbox"
          checked={showHistory}
          onChange={(event) => setShowHistory(event.target.checked)}
        />{' '}
        Hiện cả dòng đã hết hạn/thu hồi
      </label>
      <Card title="Điều phối">
        <MemberTable
          groupId={group.id}
          rows={visibleRows.filter((row) => row.memberRole === 'COORDINATOR')}
          canManage={canManage}
        />
      </Card>
      <Card title="Thành viên">
        <MemberTable
          groupId={group.id}
          rows={visibleRows.filter((row) => row.memberRole === 'MEMBER')}
          canManage={canManage}
        />
      </Card>
      <AddMemberModal
        groupId={group.id}
        memberRole={memberRole}
        members={group.members}
        onClose={() => setMemberRole(null)}
      />
    </Flex>
  );
}
