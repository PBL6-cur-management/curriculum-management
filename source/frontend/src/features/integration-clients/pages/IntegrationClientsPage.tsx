import {
  Alert,
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Typography,
  type TableColumnsType,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../../../shared/api/pagination';
import {
  DataTable,
  FilterBar,
  ListPageLayout,
  PageHeader,
  StatusTag,
  formatEmpty,
} from '../../../shared/design-system';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import {
  DDUT_DOCS_URL,
  type IntegrationClient,
  type IntegrationClientQuery,
  type IntegrationClientStatus,
  type IssuedIntegrationClient,
} from '../api/integrationClients';
import {
  CLIENT_NAME_MAX,
  CLIENT_STATUS_COLORS,
  CLIENT_STATUS_LABELS,
  DEFAULT_RATE_PER_MINUTE,
} from '../constants/integrationLabels';
import {
  useCreateIntegrationClient,
  useIntegrationClients,
  useLockIntegrationClient,
  useUpdateIntegrationClient,
} from '../hooks/useIntegrationClients';

interface ClientForm {
  clientName: string;
  rateLimit: number;
}

const formatTime = (iso: string) => dayjs(iso).format('DD/MM/YYYY HH:mm');

function ClientFormFields() {
  return (
    <>
      <Form.Item
        name="clientName"
        label="Tên bên tích hợp"
        rules={[
          {
            required: true,
            whitespace: true,
            message: 'Nhập tên bên tích hợp',
          },
          { max: CLIENT_NAME_MAX, message: `Tối đa ${CLIENT_NAME_MAX} ký tự` },
        ]}
      >
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="rateLimit"
        label="Giới hạn lần gọi mỗi phút"
        rules={[{ required: true, message: 'Nhập giới hạn' }]}
      >
        <InputNumber min={1} precision={0} style={{ width: 160 }} />
      </Form.Item>
    </>
  );
}

// Shown once, right after creation. Closing it unmounts the key; there is no way to see it again.
function IssuedKeyModal({
  issued,
  onClose,
}: {
  issued: IssuedIntegrationClient;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      title={`Khóa API của ${issued.client.clientName}`}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <Button type="primary" onClick={onClose}>
          Tôi đã lưu khóa
        </Button>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          title="Khóa chỉ hiển thị một lần"
          description="Hệ thống chỉ lưu bản băm của khóa. Sao chép và chuyển cho máy chủ của bên tích hợp qua kênh an toàn; không đưa khóa vào ứng dụng di động."
        />
        <Typography.Paragraph
          copyable={{ text: issued.apiKey }}
          code
          style={{ wordBreak: 'break-all', marginBottom: 0 }}
        >
          {issued.apiKey}
        </Typography.Paragraph>
      </Space>
    </Modal>
  );
}

// MH-11. R1 issues and manages dDUT's server keys; a lock refuses every later call at once.
export function IntegrationClientsPage() {
  const { message } = App.useApp();
  const [search, setSearch] = useSearchParams();
  const status = (
    Object.keys(CLIENT_STATUS_LABELS) as IntegrationClientStatus[]
  ).find((value) => value === search.get('status'));
  const rawPage = Number(search.get('page') ?? 1);
  const rawSize = Number(search.get('pageSize') ?? DEFAULT_PAGE_SIZE);
  const query: IntegrationClientQuery = {
    search: search.get('q') || undefined,
    status,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE,
  };
  const clients = useIntegrationClients(query);
  const create = useCreateIntegrationClient();
  const update = useUpdateIntegrationClient();
  const lock = useLockIntegrationClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IntegrationClient | null>(null);
  const [issued, setIssued] = useState<IssuedIntegrationClient | null>(null);
  const [createForm] = Form.useForm<ClientForm>();
  const [editForm] = Form.useForm<ClientForm>();

  function change(
    values: Record<string, string | undefined>,
    resetPage = true,
  ) {
    const next = new URLSearchParams(search);
    if (resetPage) next.delete('page');
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearch(next);
  }

  async function submitCreate(values: ClientForm) {
    try {
      const result = await create.mutateAsync(values);
      setCreating(false);
      createForm.resetFields();
      setIssued(result);
    } catch (error) {
      if (!applyFieldErrors(createForm, error))
        void message.error(errorMessage(error, 'Không tạo được bên tích hợp.'));
    }
  }

  async function submitEdit(values: ClientForm) {
    if (!editing) return;
    try {
      await update.mutateAsync({ id: editing.id, body: values });
      setEditing(null);
      void message.success('Đã lưu bên tích hợp');
    } catch (error) {
      if (!applyFieldErrors(editForm, error))
        void message.error(errorMessage(error, 'Không lưu được bên tích hợp.'));
    }
  }

  async function toggleLock(client: IntegrationClient) {
    const locked = client.status === 'ACTIVE';
    try {
      await lock.mutateAsync({ id: client.id, locked });
      void message.success(
        locked ? 'Đã khóa bên tích hợp' : 'Đã mở khóa bên tích hợp',
      );
    } catch (error) {
      void message.error(errorMessage(error, 'Không đổi được trạng thái.'));
    }
  }

  const columns: TableColumnsType<IntegrationClient> = [
    { title: 'Tên bên tích hợp', dataIndex: 'clientName' },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: IntegrationClientStatus) => (
        <StatusTag
          status={value}
          colorMap={CLIENT_STATUS_COLORS}
          labelMap={CLIENT_STATUS_LABELS}
        />
      ),
    },
    { title: 'Giới hạn/phút', dataIndex: 'rateLimit', align: 'right' },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      render: (value: string, row) => (
        <>
          {formatTime(value)}
          <Typography.Text type="secondary">
            {' '}
            · {row.createdByName}
          </Typography.Text>
        </>
      ),
    },
    {
      title: 'Lần gọi gần nhất',
      dataIndex: 'lastCalledAt',
      render: (value: string | null) =>
        value ? formatTime(value) : formatEmpty(value, 'Chưa gọi'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, row) => (
        <Space size="small">
          <Button
            size="small"
            onClick={() => {
              editForm.setFieldsValue({
                clientName: row.clientName,
                rateLimit: row.rateLimit,
              });
              setEditing(row);
            }}
          >
            Sửa
          </Button>
          <Popconfirm
            title={
              row.status === 'ACTIVE'
                ? 'Khóa bên tích hợp này? Mọi lần gọi sau đó bị từ chối.'
                : 'Mở khóa bên tích hợp này?'
            }
            okText={row.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
            cancelText="Hủy"
            onConfirm={() => toggleLock(row)}
          >
            <Button size="small" danger={row.status === 'ACTIVE'}>
              {row.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageLayout
      header={
        <PageHeader
          title="Bên tích hợp dDUT"
          subtitle="Khóa API cho máy chủ của dDUT đọc chương trình, tiến độ và điều kiện của sinh viên. Chỉ đọc, giới hạn theo phút, mọi lần gọi được ghi nhận."
          actions={
            <Space wrap>
              <Button
                href={DDUT_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Tài liệu API dDUT
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  createForm.setFieldsValue({
                    clientName: '',
                    rateLimit: DEFAULT_RATE_PER_MINUTE,
                  });
                  setCreating(true);
                }}
              >
                Thêm bên tích hợp
              </Button>
            </Space>
          }
        />
      }
      filters={
        <FilterBar>
          <Input.Search
            aria-label="Tìm bên tích hợp"
            placeholder="Tìm theo tên"
            allowClear
            defaultValue={query.search}
            style={{ width: 260 }}
            onSearch={(value) => change({ q: value.trim() || undefined })}
          />
          <Select
            aria-label="Lọc trạng thái"
            placeholder="Trạng thái"
            allowClear
            value={status}
            style={{ minWidth: 180 }}
            options={Object.entries(CLIENT_STATUS_LABELS).map(
              ([value, label]) => ({
                value,
                label,
              }),
            )}
            onChange={(value) => change({ status: value })}
          />
        </FilterBar>
      }
      table={
        <>
          {clients.error && (
            <Alert
              type="error"
              showIcon
              title={errorMessage(
                clients.error,
                'Không tải được danh sách bên tích hợp.',
              )}
              action={
                <Button onClick={() => void clients.refetch()}>Thử lại</Button>
              }
            />
          )}
          <DataTable
            rowKey="id"
            columns={columns}
            dataSource={clients.isError ? [] : (clients.data?.items ?? [])}
            total={clients.isError ? 0 : (clients.data?.total ?? 0)}
            page={query.page!}
            pageSize={query.pageSize}
            loading={clients.isPending}
            onPageChange={(page, pageSize) =>
              change(
                {
                  page: String(pageSize !== query.pageSize ? 1 : page),
                  pageSize: String(pageSize),
                },
                false,
              )
            }
            emptyText="Chưa có bên tích hợp nào"
            scroll={{ x: 900 }}
          />
          <Modal
            open={creating}
            title="Thêm bên tích hợp"
            okText="Tạo và cấp khóa"
            cancelText="Hủy"
            confirmLoading={create.isPending}
            onOk={() => createForm.submit()}
            onCancel={() => setCreating(false)}
            destroyOnHidden
          >
            <Form form={createForm} layout="vertical" onFinish={submitCreate}>
              <ClientFormFields />
            </Form>
          </Modal>
          <Modal
            open={editing !== null}
            title="Sửa bên tích hợp"
            okText="Lưu"
            cancelText="Hủy"
            confirmLoading={update.isPending}
            onOk={() => editForm.submit()}
            onCancel={() => setEditing(null)}
          >
            <Form form={editForm} layout="vertical" onFinish={submitEdit}>
              <ClientFormFields />
            </Form>
          </Modal>
          {issued && (
            <IssuedKeyModal issued={issued} onClose={() => setIssued(null)} />
          )}
        </>
      }
    />
  );
}
