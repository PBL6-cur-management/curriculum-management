import { Alert, Button, Form, Modal } from 'antd';
import { useState } from 'react';
import { CourseSelect } from '../../../shared/courses/CourseSelect';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { ApiError } from '../../../shared/api/client';
import type { EquivalenceGroup } from '../api/equivalenceGroups';
import {
  useAddEquivalenceMember,
  useCourseGroup,
} from '../hooks/useEquivalenceGroups';

const COURSE_ALREADY_GROUPED = 'COURSE_ALREADY_GROUPED';

export interface OtherGroupRef {
  id: string;
  groupCode: string;
}

interface AddMemberModalProps {
  group: EquivalenceGroup;
  onClose: () => void;
  // Called with the course's current group when the user chooses to merge instead.
  onMerge: (otherGroup: OtherGroupRef) => void;
}

export function AddMemberModal({
  group,
  onClose,
  onMerge,
}: AddMemberModalProps) {
  const [form] = Form.useForm<{ courseId: string }>();
  const add = useAddEquivalenceMember();
  const [error, setError] = useState<string | null>(null);
  const [clashingCourseId, setClashingCourseId] = useState<string | null>(null);
  // The merge needs the id of the group the course sits in; the course page carries it.
  const { data: clashing } = useCourseGroup(
    clashingCourseId ?? '',
    clashingCourseId !== null,
  );
  const otherGroup =
    clashing?.equivalenceGroup && clashing.equivalenceGroup.id !== group.id
      ? clashing.equivalenceGroup
      : null;

  const onFinish = ({ courseId }: { courseId: string }) => {
    setError(null);
    setClashingCourseId(null);
    add.mutate(
      { groupId: group.id, courseId },
      {
        onSuccess: onClose,
        onError: (reason) => {
          setError(errorMessage(reason, 'Không thêm được học phần vào nhóm.'));
          if (
            reason instanceof ApiError &&
            reason.code === COURSE_ALREADY_GROUPED
          )
            setClashingCourseId(courseId);
        },
      },
    );
  };

  return (
    <Modal
      open
      title={`Thêm học phần vào nhóm ${group.groupCode}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={add.isPending}
      okText="Thêm"
      cancelText="Hủy"
    >
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
          action={
            otherGroup && (
              <Button
                size="small"
                onClick={() =>
                  onMerge({
                    id: otherGroup.id,
                    groupCode: otherGroup.groupCode,
                  })
                }
              >
                Gộp nhóm
              </Button>
            )
          }
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={() => {
          setError(null);
          setClashingCourseId(null);
        }}
      >
        <Form.Item
          name="courseId"
          label="Học phần"
          rules={[{ required: true, message: 'Chọn học phần.' }]}
        >
          <CourseSelect excludeIds={group.members.map((member) => member.id)} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
