import { DeleteOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Typography,
} from 'antd';
import { useState } from 'react';
import { CourseSelect } from '../../../shared/courses/CourseSelect';
import {
  GRADE_POINT_MESSAGE,
  GRADE_POINT_PATTERN,
} from '../../../shared/courses/gradePoint';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  CurriculumItem,
  CurriculumRequisiteType,
} from '../api/curriculum';
import {
  REQUISITES_INTRO,
  REQUISITE_TYPE_LABELS,
} from '../constants/curriculumLabels';
import { useReplaceRequisites } from '../hooks/useCurriculum';
import { CURRICULUM_FORM_LIMITS } from '../schema/curriculumRules';

interface RequisitesModalProps {
  versionId: string;
  item: CurriculumItem;
  onClose: () => void;
}

interface RequisiteRowValues {
  sourceCourseId?: string;
  relationType?: CurriculumRequisiteType;
  minScore?: string | null;
}

interface RequisitesFormValues {
  requisites: RequisiteRowValues[];
}

// Old prerequisites stay valid for a curriculum, so the picker offers Discontinued courses too (US-023 AC4).
const SOURCE_STATUSES = ['ACTIVE', 'DISCONTINUED'] as const;

const TYPE_OPTIONS = (
  Object.keys(REQUISITE_TYPE_LABELS) as CurriculumRequisiteType[]
).map((value) => ({ value, label: REQUISITE_TYPE_LABELS[value] }));

export function RequisitesModal({
  versionId,
  item,
  onClose,
}: RequisitesModalProps) {
  const [form] = Form.useForm<RequisitesFormValues>();
  const replace = useReplaceRequisites(versionId);
  // The server words the cycle error and it carries the path, so it stays visible inside the dialog instead of a toast.
  const [serverError, setServerError] = useState<string | null>(null);
  const initialLabels = Object.fromEntries(
    item.requisites.map((requisite) => [
      requisite.sourceCourse.id,
      `${requisite.sourceCourse.courseCode} — ${requisite.sourceCourse.courseName} (${requisite.sourceCourse.credits} TC)`,
    ]),
  );

  const submit = (values: RequisitesFormValues) => {
    setServerError(null);
    replace.mutate(
      {
        itemId: item.id,
        body: {
          requisites: values.requisites.map((row) => ({
            sourceCourseId: row.sourceCourseId as string,
            relationType: row.relationType as CurriculumRequisiteType,
            minScore:
              row.relationType === 'PREREQUISITE' && row.minScore?.trim()
                ? row.minScore.trim()
                : null,
          })),
        },
      },
      {
        onSuccess: onClose,
        onError: (reason) =>
          setServerError(errorMessage(reason, 'Không lưu được điều kiện.')),
      },
    );
  };

  return (
    <Modal
      open
      width={720}
      title={`Điều kiện của ${item.course.courseCode} — ${item.course.courseName}`}
      okText="Lưu"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={replace.isPending}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        {REQUISITES_INTRO}
      </Typography.Paragraph>
      {serverError && (
        <Alert
          type="error"
          showIcon
          title={serverError}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form<RequisitesFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          requisites: item.requisites.map((requisite) => ({
            sourceCourseId: requisite.sourceCourse.id,
            relationType: requisite.relationType,
            minScore: requisite.minScore,
          })),
        }}
        onFinish={submit}
        onValuesChange={() => setServerError(null)}
      >
        <Form.List name="requisites">
          {(fields, { add, remove }) => (
            <Flex vertical gap="small">
              {fields.map((field) => (
                <Flex key={field.key} gap="small" align="start">
                  <Form.Item
                    name={[field.name, 'sourceCourseId']}
                    label="Học phần điều kiện"
                    rules={[{ required: true, message: 'Chọn học phần.' }]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <CourseSelect
                      excludeIds={[item.course.id]}
                      statuses={SOURCE_STATUSES}
                      initialLabels={initialLabels}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'relationType']}
                    label="Loại"
                    rules={[{ required: true, message: 'Chọn loại.' }]}
                    style={{ width: 140, marginBottom: 0 }}
                  >
                    <Select options={TYPE_OPTIONS} />
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(
                      before: RequisitesFormValues,
                      after: RequisitesFormValues,
                    ) =>
                      before.requisites?.[field.name]?.relationType !==
                      after.requisites?.[field.name]?.relationType
                    }
                  >
                    {() =>
                      form.getFieldValue([
                        'requisites',
                        field.name,
                        'relationType',
                      ]) === 'PREREQUISITE' ? (
                        <Form.Item
                          name={[field.name, 'minScore']}
                          label="Ngưỡng điểm"
                          rules={[
                            {
                              pattern: GRADE_POINT_PATTERN,
                              message: GRADE_POINT_MESSAGE,
                            },
                          ]}
                          style={{ width: 120, marginBottom: 0 }}
                        >
                          <Input inputMode="decimal" />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="Bỏ điều kiện"
                    style={{ marginTop: 30 }}
                    onClick={() => remove(field.name)}
                  />
                </Flex>
              ))}
              <div>
                <Button
                  onClick={() => add({ relationType: 'PREREQUISITE' })}
                  disabled={
                    fields.length >= CURRICULUM_FORM_LIMITS.REQUISITES_MAX
                  }
                >
                  Thêm điều kiện
                </Button>
              </div>
            </Flex>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
