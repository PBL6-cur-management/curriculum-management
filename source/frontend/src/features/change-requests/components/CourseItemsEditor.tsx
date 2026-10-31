import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import { useMemo, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { useCan } from '../../../shared/auth/useCan';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { CourseSelect } from '../../../shared/courses/CourseSelect';
import {
  GRADE_POINT_MESSAGE,
  GRADE_POINT_PATTERN,
} from '../../../shared/courses/gradePoint';
import { compareDecimals } from '../../../shared/decimal/decimal';
import {
  CREDITS_MESSAGE,
  CREDITS_PATTERN,
} from '../../../shared/forms/credits';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { useSubjectGroups } from '../../../shared/subject-groups/useSubjectGroups';
import type {
  ChangeRequestDetail,
  CourseInfo,
  CourseRelationRow,
  CourseRequestField,
} from '../api/changeRequests';
import {
  BLANK_MEANS_UNCHANGED,
  COURSE_FIELD_LABELS,
  COURSE_FIELDS,
  COURSE_TYPE_LABELS,
  MIN_SCORE_HINT,
  RELATION_CHOICES,
} from '../constants/courseItemLabels';
import {
  useCourseInfo,
  useCourseRelationRows,
  useReplaceAuthoredItems,
} from '../hooks/useChangeRequests';
import {
  additionFor,
  itemsFromState,
  relationReading,
  stateFromItems,
  type CourseItemsState,
} from '../utils/courseItems';

interface CourseItemsEditorProps {
  request: ChangeRequestDetail;
}

const SAVED = 'Đã lưu các thay đổi.';

function currentValue(
  course: CourseInfo,
  field: CourseRequestField,
): string | null {
  switch (field) {
    case 'courseName':
      return course.courseName;
    case 'englishName':
      return course.englishName;
    case 'credits':
      return course.credits;
    case 'courseType':
      return course.courseType;
    case 'ownerGroupId':
      return course.ownerGroup?.id ?? null;
  }
}

function sameValue(
  field: CourseRequestField,
  left: string | null,
  right: string | null,
) {
  if (field === 'credits' && left !== null && right !== null)
    return compareDecimals(left, right) === 0;
  return (left ?? '') === (right ?? '');
}

// COURSE_RELATION requests (US-053 AC4): course attributes and relations are typed in as items, saved together.
export function CourseItemsEditor({ request }: CourseItemsEditorProps) {
  const courseId = request.target.id;
  const { data: course } = useCourseInfo(courseId);
  const { data: relations } = useCourseRelationRows(courseId);
  if (!course || !relations) return <Skeleton active />;
  return <ItemsForm request={request} course={course} relations={relations} />;
}

interface ItemsFormProps {
  request: ChangeRequestDetail;
  course: CourseInfo;
  relations: CourseRelationRow[];
}

function ItemsForm({ request, course, relations }: ItemsFormProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const save = useReplaceAuthoredItems(request.id);
  const [state, setItemsState] = useState<CourseItemsState>(() =>
    stateFromItems(request.authoredItems),
  );
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // Any edit clears the mark on the refused row.
  const setState: React.Dispatch<React.SetStateAction<CourseItemsState>> = (
    next,
  ) => {
    setErrorKey(null);
    setItemsState(next);
  };
  const [adding, setAdding] = useState(false);
  const canPickGroup = useCan(PERMISSIONS.subjectGroupView);
  const { data: groups = [] } = useSubjectGroups(
    { facultyId: course.ownerFaculty.id, status: 'ACTIVE' },
    canPickGroup,
  );
  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        value: group.id,
        label: `${group.groupCode} — ${group.groupName}`,
      })),
    [groups],
  );
  const editable = request.permissions.canEdit;
  const fields = COURSE_FIELDS.filter(
    (field) => field !== 'ownerGroupId' || canPickGroup,
  );

  const setField = (
    field: CourseRequestField,
    value: string | null | undefined,
  ) =>
    setState((current) => {
      const next = { ...current.fields };
      // Blank or equal to the current value means no item.
      if (
        value === undefined ||
        value === '' ||
        sameValue(field, value, currentValue(course, field))
      )
        delete next[field];
      else next[field] = value;
      return { ...current, fields: next };
    });

  const onSave = () => {
    const { items, keys } = itemsFromState(state);
    save.mutate(items, {
      onSuccess: () => void message.success(SAVED),
      onError: (error) => {
        const detail =
          error instanceof ApiError ? error.details?.[0]?.field : undefined;
        const index = detail
          ? Number(/^items\.(\d+)$/.exec(detail)?.[1])
          : Number.NaN;
        setErrorKey(Number.isNaN(index) ? null : (keys[index] ?? null));
        void message.error(errorMessage(error, 'Không lưu được các thay đổi.'));
      },
    });
  };

  const changes = itemsFromState(state).items.length;
  return (
    <Flex vertical gap="middle">
      <Card title="Thông tin học phần">
        <Table
          size="small"
          rowKey="field"
          pagination={false}
          dataSource={fields.map((field) => ({ field }))}
          onRow={({ field }) => ({
            style:
              errorKey === `field:${field}`
                ? { background: token.colorErrorBg }
                : undefined,
          })}
          columns={[
            {
              title: 'Thuộc tính',
              render: (_v, { field }) => COURSE_FIELD_LABELS[field],
            },
            {
              title: 'Hiện tại',
              render: (_v, { field }) =>
                field === 'ownerGroupId'
                  ? (course.ownerGroup?.groupCode ?? '—')
                  : field === 'courseType'
                    ? COURSE_TYPE_LABELS[course.courseType]
                    : (currentValue(course, field) ?? '—'),
            },
            {
              title: 'Giá trị mới',
              render: (_v, { field }) => (
                <FieldInput
                  field={field}
                  value={state.fields[field]}
                  disabled={!editable}
                  groupOptions={groupOptions}
                  onChange={(value) => setField(field, value)}
                />
              ),
            },
          ]}
        />
        <Typography.Text type="secondary">
          {BLANK_MEANS_UNCHANGED}
        </Typography.Text>
      </Card>
      <Card
        title="Quan hệ học phần"
        extra={
          editable && (
            <Button onClick={() => setAdding(true)}>Thêm quan hệ</Button>
          )
        }
      >
        <RelationTable
          course={course}
          relations={relations}
          state={state}
          setState={setState}
          errorKey={errorKey}
          editable={editable}
        />
      </Card>
      {errorKey && (
        <Alert
          type="error"
          showIcon
          title="Một mục bị từ chối; kiểm tra dòng được tô đỏ."
        />
      )}
      {editable && (
        <Flex>
          <Button type="primary" onClick={onSave} loading={save.isPending}>
            Lưu thay đổi{changes > 0 ? ` (${changes})` : ''}
          </Button>
        </Flex>
      )}
      {adding && (
        <AddRelationModal
          currentId={course.id}
          onClose={() => setAdding(false)}
          onAdd={(addition) => {
            setState((current) => ({
              ...current,
              additions: [...current.additions, addition],
            }));
            setAdding(false);
          }}
        />
      )}
    </Flex>
  );
}

interface FieldInputProps {
  field: CourseRequestField;
  value: string | null | undefined;
  disabled: boolean;
  groupOptions: { value: string; label: string }[];
  onChange: (value: string | null | undefined) => void;
}

function FieldInput({
  field,
  value,
  disabled,
  groupOptions,
  onChange,
}: FieldInputProps) {
  const label = COURSE_FIELD_LABELS[field];
  if (field === 'courseType')
    return (
      <Select
        aria-label={label}
        allowClear
        disabled={disabled}
        value={value ?? undefined}
        onChange={(next: string | undefined) => onChange(next)}
        options={Object.entries(COURSE_TYPE_LABELS).map(([key, text]) => ({
          value: key,
          label: text,
        }))}
        style={{ minWidth: 200 }}
      />
    );
  if (field === 'ownerGroupId')
    return (
      <Select
        aria-label={label}
        allowClear
        disabled={disabled}
        value={value ?? undefined}
        onChange={(next: string | undefined) => onChange(next)}
        options={groupOptions}
        placeholder="Chọn nhóm"
        style={{ minWidth: 240 }}
      />
    );
  const invalid =
    field === 'credits' && value ? !CREDITS_PATTERN.test(value) : false;
  return (
    <Flex vertical gap={2}>
      <Input
        aria-label={label}
        disabled={disabled}
        status={invalid ? 'error' : undefined}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        inputMode={field === 'credits' ? 'decimal' : undefined}
      />
      {invalid && (
        <Typography.Text type="danger">{CREDITS_MESSAGE}</Typography.Text>
      )}
    </Flex>
  );
}

interface RelationTableProps {
  course: CourseInfo;
  relations: CourseRelationRow[];
  state: CourseItemsState;
  setState: React.Dispatch<React.SetStateAction<CourseItemsState>>;
  errorKey: string | null;
  editable: boolean;
}

function RelationTable({
  course,
  relations,
  state,
  setState,
  errorKey,
  editable,
}: RelationTableProps) {
  const { token } = theme.useToken();
  const [editing, setEditing] = useState<CourseRelationRow | null>(null);
  const edit = (
    relationId: string,
    value: CourseItemsState['relationEdits'][string] | null,
  ) =>
    setState((current) => {
      const next = { ...current.relationEdits };
      if (value === null) delete next[relationId];
      else next[relationId] = value;
      return { ...current, relationEdits: next };
    });
  return (
    <>
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        locale={{ emptyText: 'Học phần chưa có quan hệ' }}
        dataSource={relations}
        onRow={(relation) => ({
          style:
            errorKey === `relation:${relation.id}`
              ? { background: token.colorErrorBg }
              : undefined,
        })}
        columns={[
          {
            title: 'Quan hệ',
            render: (_v, relation) => relationReading(relation, course.id),
          },
          {
            title: 'Ngưỡng điểm',
            render: (_v, relation) => {
              const change = state.relationEdits[relation.id];
              if (change?.kind === 'remove')
                return <Tag color="error">Xóa</Tag>;
              if (change?.kind === 'update')
                return (
                  <>
                    {relation.minScore ?? '—'} →{' '}
                    <strong>{change.minScore ?? '—'}</strong>
                  </>
                );
              return relation.minScore ?? '—';
            },
          },
          {
            title: 'Thao tác',
            render: (_v, relation) =>
              !editable ? null : state.relationEdits[relation.id] ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => edit(relation.id, null)}
                >
                  Hoàn tác
                </Button>
              ) : (
                <Flex gap="small">
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setEditing(relation)}
                  >
                    Sửa ngưỡng
                  </Button>
                  <Button
                    type="link"
                    danger
                    size="small"
                    onClick={() => edit(relation.id, { kind: 'remove' })}
                  >
                    Xóa
                  </Button>
                </Flex>
              ),
          },
        ]}
      />
      {state.additions.length > 0 && (
        <Table
          style={{ marginTop: 12 }}
          size="small"
          rowKey={(_row, index) => String(index)}
          pagination={false}
          dataSource={state.additions}
          onRow={(_row, index) => ({
            style:
              errorKey === `add:${index}`
                ? { background: token.colorErrorBg }
                : undefined,
          })}
          columns={[
            {
              title: 'Quan hệ thêm mới',
              render: (_v, addition) => (
                <Tag color="success">
                  {addition.sourceCourseId === course.id
                    ? 'Là nguồn'
                    : 'Là đích'}{' '}
                  · {addition.relationType}
                  {addition.minScore ? ` · ngưỡng ${addition.minScore}` : ''}
                </Tag>
              ),
            },
            {
              title: 'Thao tác',
              render: (_v, _addition, index) =>
                editable && (
                  <Button
                    type="link"
                    danger
                    size="small"
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        additions: current.additions.filter(
                          (_x, at) => at !== index,
                        ),
                      }))
                    }
                  >
                    Bỏ
                  </Button>
                ),
            },
          ]}
        />
      )}
      {editing && (
        <MinScoreModal
          relation={editing}
          onClose={() => setEditing(null)}
          onSave={(minScore) => {
            edit(editing.id, { kind: 'update', minScore });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

interface MinScoreModalProps {
  relation: CourseRelationRow;
  onClose: () => void;
  onSave: (minScore: string | null) => void;
}

function MinScoreModal({ relation, onClose, onSave }: MinScoreModalProps) {
  const [form] = Form.useForm<{ minScore?: string }>();
  return (
    <Modal
      open
      title="Sửa ngưỡng điểm"
      okText="Đồng ý"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ minScore: relation.minScore ?? '' }}
        onFinish={({ minScore }) =>
          onSave(minScore?.trim() ? minScore.trim() : null)
        }
      >
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
      </Form>
    </Modal>
  );
}

interface AddRelationModalProps {
  currentId: string;
  onClose: () => void;
  onAdd: (addition: ReturnType<typeof additionFor>) => void;
}

interface AddValues {
  choice: (typeof RELATION_CHOICES)[number]['key'];
  otherId: string;
  minScore?: string;
}

function AddRelationModal({
  currentId,
  onClose,
  onAdd,
}: AddRelationModalProps) {
  const [form] = Form.useForm<AddValues>();
  return (
    <Modal
      open
      title="Thêm quan hệ"
      okText="Thêm"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form<AddValues>
        form={form}
        layout="vertical"
        onFinish={(values) =>
          onAdd(
            additionFor(
              values.choice,
              currentId,
              values.otherId,
              values.minScore?.trim() ? values.minScore.trim() : null,
            ),
          )
        }
      >
        <Form.Item
          name="choice"
          label="Quan hệ"
          rules={[{ required: true, message: 'Chọn quan hệ.' }]}
        >
          <Select
            placeholder="Chọn quan hệ"
            options={RELATION_CHOICES.map((choice) => ({
              value: choice.key,
              label: choice.label,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="otherId"
          label="Học phần kia"
          rules={[{ required: true, message: 'Chọn học phần.' }]}
        >
          <CourseSelect excludeIds={[currentId]} />
        </Form.Item>
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
      </Form>
    </Modal>
  );
}
