import { Alert, List, Modal, Spin, Typography } from 'antd';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import type { SubjectGroupSummary } from '../../../shared/subject-groups/subjectGroups';
import {
  useDeactivateSubjectGroup,
  useDeactivationImpact,
} from '../hooks/useSubjectGroupAdmin';

interface DeactivateGroupModalProps {
  group: SubjectGroupSummary | null;
  onClose: () => void;
}
export function DeactivateGroupModal({
  group,
  onClose,
}: DeactivateGroupModalProps) {
  const impact = useDeactivationImpact(group?.id ?? null);
  const deactivate = useDeactivateSubjectGroup();
  const [error, setError] = useState('');
  async function confirm() {
    if (!group) return;
    try {
      await deactivate.mutateAsync(group.id);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : 'Không thể ngừng sử dụng nhóm',
      );
    }
  }
  return (
    <Modal
      open={group !== null}
      title="Ngừng sử dụng nhóm"
      okText="Ngừng sử dụng"
      okButtonProps={{ danger: true, disabled: !impact.data || impact.isError }}
      confirmLoading={deactivate.isPending}
      onCancel={onClose}
      onOk={() => void confirm()}
    >
      {impact.isError ? (
        <Alert
          type="error"
          title="Không tải được danh sách ảnh hưởng; chưa thể ngừng sử dụng nhóm."
        />
      ) : !impact.data ? (
        <Spin />
      ) : (
        <>
          <Typography.Paragraph>
            {impact.data.activeMemberCount} thành viên đang hiệu lực
          </Typography.Paragraph>
          <Typography.Paragraph>
            Điều phối:{' '}
            {impact.data.activeCoordinators
              .map((person) => person.fullName)
              .join(', ') || 'Không có'}
          </Typography.Paragraph>
          <List
            dataSource={impact.data.courses}
            locale={{ emptyText: 'Không có học phần nào đang gắn với nhóm' }}
            renderItem={(course) => (
              <List.Item>
                {course.courseCode} — {course.courseName}
              </List.Item>
            )}
          />
          <Typography.Paragraph>
            Nhóm không bị xóa; thành viên và Điều phối mất phạm vi trên nhóm cho
            tới khi kích hoạt lại.
          </Typography.Paragraph>
        </>
      )}
      {error && <Alert type="error" title={error} />}
    </Modal>
  );
}
