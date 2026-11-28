import { PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { PageHeader } from '../../../shared/design-system';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import type {
  CreateMajorRequest,
  MajorItem,
  MajorStatus,
} from '../api/majors';
import {
  useCreateMajor,
  useMajors,
  useSetMajorStatus,
  useUpdateMajor,
} from '../hooks/useMajors';
import { MAJOR_CODE_RULES, MAJOR_NAME_RULES } from '../schema/majorRules';

const DEGREE_GROUP_LABELS: Record<string, string> = {
  CD01: 'Đại học (7xxxxxx)',
  CD02: 'Thạc sĩ (8xxxxxx)',
  CD03: 'Tiến sĩ (9xxxxxx)',
};

const DEGREE_GROUP_OPTIONS = Object.entries(DEGREE_GROUP_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const FACULTY_TYPES = ['FACULTY'] as const;

export function MajorsPage() {
  const { message } = App.useApp();
  const canManage = useCan(PERMISSIONS.programEditInfo);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState('');
  const [degreeGroup, setDegreeGroup] = useState<string | undefined>();
  const [status, setStatus] = useState<MajorStatus | undefined>();
  const [facultyId, setFacultyId] = useState<string | undefined>();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MajorItem | null>(null);
  const [form] = Form.useForm<CreateMajorRequest>();

  const majors = useMajors({
    page,
    pageSize,
    q: q.trim() || undefined,
    degreeGroup,
    status,
    facultyId,
  });

  const createMutation = useCreateMajor();
  const updateMutation = useUpdateMajor();
  const statusMutation = useSetMajorStatus();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (item: MajorItem) => {
    setEditing(item);
    form.setFieldsValue({
      majorCode: item.majorCode,
      majorName: item.majorName,
      englishName: item.englishName ?? '',
      degreeGroup: item.degreeGroup ?? undefined,
      facultyId: item.faculty?.id ?? undefined,
    });
    setModalOpen(true);
  };

  const handleSave = (values: CreateMajorRequest) => {
    const onSuccess = () => {
      void message.success(
        editing ? 'Đã cập nhật ngành đào tạo.' : 'Đã thêm ngành đào tạo mới.',
      );
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
    };
    const onError = (err: unknown) => {
      if (!applyFieldErrors(form, err))
        void message.error(errorMessage(err, 'Không lưu được ngành đào tạo.'));
    };

    if (editing) {
      updateMutation.mutate(
        {
          majorId: editing.id,
          body: {
            majorName: values.majorName,
            englishName: values.englishName || null,
            degreeGroup: values.degreeGroup ?? null,
            facultyId: values.facultyId ?? null,
          },
        },
        { onSuccess, onError },
      );
      return;
    }
    createMutation.mutate(
      {
        ...values,
        englishName: values.englishName || null,
        degreeGroup: values.degreeGroup ?? null,
        facultyId: values.facultyId ?? null,
      },
      { onSuccess, onError },
    );
  };

  const handleStatusToggle = (row: MajorItem) => {
    const next: MajorStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    statusMutation.mutate(
      { majorId: row.id, status: next },
      {
        onSuccess: () => void message.success('Đã cập nhật trạng thái ngành.'),
        onError: (err) =>
          void message.error(
            errorMessage(err, 'Không đổi được trạng thái ngành.'),
          ),
      },
    );
  };

  const columns: ColumnsType<MajorItem> = [
    {
      title: 'Mã ngành',
      dataIndex: 'majorCode',
      key: 'majorCode',
      width: 130,
      render: (code: string) => (
        <Typography.Text strong>{code}</Typography.Text>
      ),
    },
    {
      title: 'Tên ngành đào tạo',
      key: 'majorName',
      render: (_, row) => (
        <Flex vertical>
          <Typography.Text>{row.majorName}</Typography.Text>
          {row.englishName && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.englishName}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: 'Bậc đào tạo',
      dataIndex: 'degreeGroup',
      key: 'degreeGroup',
      width: 170,
      render: (val: string | null) =>
        val ? (
          <Tag>{DEGREE_GROUP_LABELS[val] ?? val}</Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Khoa phụ trách',
      key: 'faculty',
      render: (_, row) =>
        row.faculty?.unitName ?? (
          <Typography.Text type="secondary">
            Toàn trường / Chưa gán
          </Typography.Text>
        ),
    },
    {
      title: 'Số CTĐT',
      dataIndex: 'programCount',
      key: 'programCount',
      width: 100,
      align: 'right',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (val: MajorStatus) => (
        <Tag color={val === 'ACTIVE' ? 'green' : 'default'}>
          {val === 'ACTIVE' ? 'Đang sử dụng' : 'Ngừng sử dụng'}
        </Tag>
      ),
    },
    ...(canManage
      ? [
          {
            title: 'Thao tác',
            key: 'actions',
            width: 170,
            render: (_: unknown, row: MajorItem) => (
              <Space size="small">
                <Button size="small" onClick={() => openEdit(row)}>
                  Sửa
                </Button>
                <Button
                  size="small"
                  loading={statusMutation.isPending}
                  onClick={() => handleStatusToggle(row)}
                >
                  {row.status === 'ACTIVE' ? 'Ngừng' : 'Mở lại'}
                </Button>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Danh mục ngành đào tạo"
        subtitle="Cấp 0 (Level 0) — quản lý mã ngành quốc gia (Đại học, Thạc sĩ, Tiến sĩ) liên kết với các chương trình đào tạo."
        actions={
          canManage ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm ngành
            </Button>
          ) : undefined
        }
      />
      <Card size="small">
        <Flex gap="small" wrap>
          <Input.Search
            placeholder="Tìm theo mã ngành hoặc tên ngành..."
            allowClear
            style={{ width: 280 }}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Bậc đào tạo"
            style={{ width: 190 }}
            options={DEGREE_GROUP_OPTIONS}
            value={degreeGroup}
            onChange={(val?: string) => {
              setDegreeGroup(val);
              setPage(1);
            }}
          />
          <div style={{ minWidth: 240 }}>
            <OrgUnitSelect
              types={FACULTY_TYPES}
              placeholder="Khoa phụ trách"
              value={facultyId}
              onChange={(val) => {
                setFacultyId(val ?? undefined);
                setPage(1);
              }}
            />
          </div>
          <Select
            allowClear
            placeholder="Trạng thái"
            style={{ width: 150 }}
            options={[
              { value: 'ACTIVE', label: 'Đang sử dụng' },
              { value: 'INACTIVE', label: 'Ngừng sử dụng' },
            ]}
            value={status}
            onChange={(val?: MajorStatus) => {
              setStatus(val);
              setPage(1);
            }}
          />
        </Flex>
      </Card>
      <Table<MajorItem>
        rowKey="id"
        loading={majors.isPending}
        dataSource={majors.data?.items ?? []}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total: majors.data?.total ?? 0,
          showSizeChanger: true,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
          },
        }}
      />
      <Modal
        open={modalOpen}
        title={
          editing
            ? `Cập nhật ngành ${editing.majorCode}`
            : 'Thêm ngành đào tạo mới'
        }
        okText={editing ? 'Lưu thay đổi' : 'Tạo ngành'}
        cancelText="Hủy"
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={isSaving}
      >
        <Form<CreateMajorRequest>
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="majorCode"
            label="Mã ngành quốc gia"
            rules={MAJOR_CODE_RULES}
          >
            <Input disabled={Boolean(editing)} placeholder="Ví dụ: 7480201" />
          </Form.Item>
          <Form.Item
            name="majorName"
            label="Tên ngành (tiếng Việt)"
            rules={MAJOR_NAME_RULES}
          >
            <Input placeholder="Ví dụ: Công nghệ Thông tin" />
          </Form.Item>
          <Form.Item name="englishName" label="Tên ngành (tiếng Anh)">
            <Input placeholder="Ví dụ: Information Technology" />
          </Form.Item>
          <Form.Item name="degreeGroup" label="Bậc đào tạo">
            <Select allowClear options={DEGREE_GROUP_OPTIONS} />
          </Form.Item>
          <Form.Item name="facultyId" label="Khoa phụ trách">
            <OrgUnitSelect
              types={FACULTY_TYPES}
              placeholder="Chọn khoa phụ trách"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
