import { Alert, Form, Input, Modal, Select } from 'antd';
import { useState } from 'react';
import { CourseSelect } from '../../../shared/courses/CourseSelect';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { CourseDetail } from '../api/courses';
import {
  MIN_SCORE_HINT,
  RELATION_CHOICES,
  type RelationChoiceKey,
} from '../constants/relationLabels';
import { useCreateCourseRelation } from '../hooks/useCourseRelations';
import {
  GRADE_POINT_MESSAGE,
  GRADE_POINT_PATTERN,
} from '../schema/courseRules';

interface AddRelationModalProps {
  course: CourseDetail;
  onClose: () => void;
}

interface AddRelationValues {
  choice: RelationChoiceKey;
  otherCourseId: string;
  minScore?: string;
}

export function AddRelationModal({ course, onClose }: AddRelationModalProps) {
  const [form] = Form.useForm<AddRelationValues>();
  const choiceKey = Form.useWatch('choice', form);
  const choice = RELATION_CHOICES.find((item) => item.key === choiceKey);
  const create = useCreateCourseRelation();
  // The server words cycle and duplicate errors (the cycle message carries the path); the client shows them as is.
  const [serverError, setServerError] = useState<string | null>(null);

  const onFinish = (values: AddRelationValues) => {
    const chosen = RELATION_CHOICES.find((item) => item.key === values.choice);
    if (!chosen) return;
    const [sourceCourseId, targetCourseId] =
      chosen.currentIs === 'source'
        ? [course.id, values.otherCourseId]
        : [values.otherCourseId, course.id];
    const minScore = values.minScore?.trim();
    create.mutate(
      {
        sourceCourseId,
        targetCourseId,
        relationType: chosen.type,
        minScore: chosen.type === 'PREREQUISITE' && minScore ? minScore : null,
      },
      {
        onSuccess: onClose,
        onError: (error) =>
          setServerError(errorMessage(error, 'Không lưu được quan hệ.')),
      },
    );
  };

  return (
    <Modal
      open
      title={`Thêm quan hệ cho ${course.courseCode}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={create.isPending}
      okText="Lưu"
      cancelText="Hủy"
    >
      {serverError && (
        <Alert
          type="error"
          showIcon
          title={serverError}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={() => setServerError(null)}
      >
        <Form.Item
          name="choice"
          label={course.courseCode}
          rules={[{ required: true, message: 'Chọn loại quan hệ.' }]}
        >
          <Select
            placeholder="Chọn loại quan hệ"
            options={RELATION_CHOICES.map((item) => ({
              value: item.key,
              label: item.label,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="otherCourseId"
          label="Học phần"
          rules={[{ required: true, message: 'Chọn học phần.' }]}
        >
          <CourseSelect excludeIds={[course.id]} />
        </Form.Item>
        {choice?.type === 'PREREQUISITE' && (
          <Form.Item
            name="minScore"
            label="Ngưỡng điểm"
            extra={MIN_SCORE_HINT}
            rules={[
              { pattern: GRADE_POINT_PATTERN, message: GRADE_POINT_MESSAGE },
            ]}
          >
            <Input inputMode="decimal" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
