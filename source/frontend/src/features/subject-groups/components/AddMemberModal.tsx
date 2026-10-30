import dayjs from 'dayjs';
import { Alert, DatePicker, Form, Modal, Select } from 'antd';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { UserSelect } from '../../../shared/users/UserSelect';
import { ISO_DAY_FORMAT } from '../../../shared/validity/validity';
import type { SubjectGroupMember } from '../api/subjectGroupAdmin';
import { useAddMember } from '../hooks/useSubjectGroupAdmin';

interface AddMemberModalProps {
  groupId: string;
  memberRole: SubjectGroupMember['memberRole'] | null;
  members: SubjectGroupMember[];
  onClose: () => void;
}
export function AddMemberModal({
  groupId,
  memberRole,
  members,
  onClose,
}: AddMemberModalProps) {
  const [form] = Form.useForm();
  const add = useAddMember();
  const [error, setError] = useState('');
  const eligibleMembers = members.filter(
    (row) =>
      row.memberRole === 'MEMBER' &&
      (row.state === 'ACTIVE' || row.state === 'SCHEDULED'),
  );
  async function submit(values: {
    lecturerId: string;
    validFrom: dayjs.Dayjs;
    validTo?: dayjs.Dayjs;
  }) {
    if (!memberRole) return;
    try {
      await add.mutateAsync({
        groupId,
        body: {
          lecturerId: values.lecturerId,
          memberRole,
          validFrom: values.validFrom.format(ISO_DAY_FORMAT),
          ...(values.validTo
            ? { validTo: values.validTo.format(ISO_DAY_FORMAT) }
            : {}),
        },
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : 'Không thể thêm thành viên',
      );
    }
  }
  return (
    <Modal
      open={memberRole !== null}
      title={
        memberRole === 'COORDINATOR' ? 'Chỉ định Điều phối' : 'Thêm thành viên'
      }
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={add.isPending}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ validFrom: dayjs() }}
      >
        <Form.Item
          name="lecturerId"
          label="Giảng viên"
          rules={[{ required: true, message: 'Chọn giảng viên' }]}
        >
          {memberRole === 'COORDINATOR' ? (
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chỉ chọn được thành viên của nhóm"
              options={[
                ...new Map(
                  eligibleMembers.map((row) => [
                    row.lecturer.id,
                    {
                      value: row.lecturer.id,
                      label: `${row.lecturer.userCode} — ${row.lecturer.fullName}`,
                    },
                  ]),
                ).values(),
              ]}
            />
          ) : (
            <UserSelect />
          )}
        </Form.Item>
        <Form.Item
          name="validFrom"
          label="Có hiệu lực từ"
          rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}
        >
          <DatePicker format={ISO_DAY_FORMAT} />
        </Form.Item>
        <Form.Item
          name="validTo"
          label="Có hiệu lực đến"
          dependencies={['validFrom']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_rule, value) {
                const from = getFieldValue('validFrom');
                return !value ||
                  !from ||
                  value.isSame(from, 'day') ||
                  value.isAfter(from, 'day')
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error('Ngày kết thúc không được trước ngày bắt đầu'),
                    );
              },
            }),
          ]}
        >
          <DatePicker format={ISO_DAY_FORMAT} />
        </Form.Item>
        {error && <Alert type="error" title={error} />}
      </Form>
    </Modal>
  );
}
