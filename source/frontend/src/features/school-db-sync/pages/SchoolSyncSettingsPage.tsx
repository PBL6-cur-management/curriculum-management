import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Switch,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { generatePath, Link, useNavigate } from 'react-router';
import { ROUTES } from '../../../routes';
import { PageHeader, PageSkeleton } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  SaveSyncConfiguration,
  SyncConfiguration,
  SyncConnectionTest,
  SyncMapping,
} from '../api/schoolSync';
import {
  CONNECTION_TEST_TONE,
  MAPPING_KIND_LABELS,
  WEEKDAY_LABELS,
} from '../constants/syncLabels';
import {
  useSaveSyncConfiguration,
  useSaveSyncMappings,
  useStartSyncRun,
  useSyncConfiguration,
  useSyncMappings,
  useTestSyncConnection,
} from '../hooks/useSchoolSync';

type FormValues = Omit<SaveSyncConfiguration, 'revision'>;

const formatTime = (iso: string) => dayjs(iso).format('HH:mm, DD/MM/YYYY');

function initialValues(config: SyncConfiguration): FormValues {
  return {
    mode: config.mode,
    profile: config.profile,
    enabled: config.enabled,
    sourceIdentity: config.sourceIdentity,
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    cadence: config.cadence,
    localTime: config.localTime,
    weekday: config.weekday ?? 1,
  };
}

// MH-12. Excel stays the default; the school database is an optional, read-only source.
export function SchoolSyncSettingsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const config = useSyncConfiguration();
  const mappings = useSyncMappings();
  const save = useSaveSyncConfiguration();
  const test = useTestSyncConnection();
  const run = useStartSyncRun();
  const [form] = Form.useForm<FormValues>();
  const [probe, setProbe] = useState<SyncConnectionTest | null>(null);
  const mode = Form.useWatch('mode', form);
  const cadence = Form.useWatch('cadence', form);
  const data = config.data;

  useEffect(() => {
    if (data) form.setFieldsValue(initialValues(data));
  }, [data, form]);

  if (config.isPending) return <PageSkeleton />;
  if (config.isError || !data) {
    return (
      <Alert
        type="error"
        showIcon
        title={errorMessage(config.error, 'Không tải được cấu hình đồng bộ.')}
        action={<Button onClick={() => void config.refetch()}>Thử lại</Button>}
      />
    );
  }

  const verified =
    data.verifiedConnectionRevision !== null &&
    data.verifiedConnectionRevision === data.connectionRevision;
  const canRun = data.mode === 'SCHOOL_DB' && verified && !data.activeRunId;

  async function onSave(values: FormValues) {
    if (!data) return;
    try {
      await save.mutateAsync({
        ...values,
        revision: data.revision,
        password: values.password || undefined,
        weekday: values.cadence === 'WEEKLY' ? values.weekday : null,
      });
      form.setFieldValue('password', undefined);
      setProbe(null);
      void message.success('Đã lưu cấu hình đồng bộ');
    } catch (error) {
      void message.error(errorMessage(error, 'Không lưu được cấu hình.'));
    }
  }

  async function onTest() {
    if (!data) return;
    try {
      setProbe(await test.mutateAsync(data.revision));
    } catch (error) {
      void message.error(errorMessage(error, 'Không kiểm tra được kết nối.'));
    }
  }

  async function onRun() {
    try {
      const started = await run.mutateAsync({ requestId: crypto.randomUUID() });
      void navigate(
        generatePath(ROUTES.schoolSyncRunDetail, { runId: started.id }),
      );
    } catch (error) {
      void message.error(
        errorMessage(error, 'Không bắt đầu được lần đồng bộ.'),
      );
    }
  }

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Đồng bộ CSDL Trường"
        subtitle="Nhập Excel luôn dùng được; nguồn CSDL Trường là tùy chọn và chỉ đọc."
        actions={
          <>
            <Link to={ROUTES.schoolSyncRuns}>Lịch sử đồng bộ</Link>
            <Button
              type="primary"
              disabled={!canRun}
              loading={run.isPending}
              onClick={() => void onRun()}
            >
              Đồng bộ ngay
            </Button>
          </>
        }
      />
      {data.activeRunId && (
        <Alert
          type="info"
          showIcon
          title="Đang có một lần đồng bộ chạy. Cấu hình và ánh xạ được khóa đến khi lần đó kết thúc."
          action={
            <Link
              to={generatePath(ROUTES.schoolSyncRunDetail, {
                runId: data.activeRunId,
              })}
            >
              Xem lần đang chạy
            </Link>
          }
        />
      )}
      {data.mode === 'SCHOOL_DB' && data.profile === 'SIMULATED_SQL_SERVER' && (
        <Alert
          type="warning"
          showIcon
          title="Đang dùng bản mô phỏng SQL Server với dữ liệu tổng hợp, không phải CSDL thật của Trường."
        />
      )}

      <Form<FormValues>
        form={form}
        layout="vertical"
        disabled={Boolean(data.activeRunId)}
        onFinish={(values) => void onSave(values)}
      >
        <Flex vertical gap="middle">
          <Card title="Nguồn dữ liệu và kết nối">
            <Form.Item name="mode" label="Nguồn hồ sơ và kết quả học tập">
              <Radio.Group
                options={[
                  { value: 'EXCEL_ONLY', label: 'Chỉ nhập Excel' },
                  {
                    value: 'SCHOOL_DB',
                    label: 'CSDL Trường (SQL Server) và Excel',
                  },
                ]}
              />
            </Form.Item>
            {mode === 'SCHOOL_DB' && (
              <>
                <Flex gap="middle" wrap>
                  <Form.Item
                    name="profile"
                    label="Loại kết nối"
                    style={{ minWidth: 260 }}
                  >
                    <Select
                      options={[
                        {
                          value: 'SIMULATED_SQL_SERVER',
                          label: 'Bản mô phỏng (máy này)',
                        },
                        {
                          value: 'EXTERNAL_SQL_SERVER',
                          label: 'Máy chủ của Trường',
                          disabled: !data.externalAllowed,
                        },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    name="host"
                    label="Máy chủ"
                    rules={[{ required: true, message: 'Nhập tên máy chủ' }]}
                    style={{ minWidth: 240 }}
                  >
                    <Input placeholder="localhost" />
                  </Form.Item>
                  <Form.Item
                    name="port"
                    label="Cổng"
                    rules={[{ required: true, message: 'Nhập cổng' }]}
                  >
                    <InputNumber min={1} max={65535} style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item
                    name="database"
                    label="Tên CSDL"
                    rules={[{ required: true, message: 'Nhập tên CSDL' }]}
                    style={{ minWidth: 220 }}
                  >
                    <Input />
                  </Form.Item>
                </Flex>
                <Flex gap="middle" wrap>
                  <Form.Item
                    name="username"
                    label="Tài khoản chỉ đọc"
                    rules={[{ required: true, message: 'Nhập tài khoản' }]}
                    style={{ minWidth: 240 }}
                  >
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="Mật khẩu"
                    extra={
                      data.passwordConfigured
                        ? 'Đã lưu; để trống để giữ nguyên. Mật khẩu không bao giờ hiển thị lại.'
                        : undefined
                    }
                    rules={[
                      {
                        required: !data.passwordConfigured,
                        message: 'Nhập mật khẩu',
                      },
                    ]}
                    style={{ minWidth: 240 }}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Form.Item
                    name="sourceIdentity"
                    label="Mã nguồn dữ liệu"
                    style={{ minWidth: 220 }}
                  >
                    <Input disabled={Boolean(data.lastSuccessfulRunId)} />
                  </Form.Item>
                </Flex>
                <Flex gap="small" align="center" wrap>
                  <Button
                    onClick={() => void onTest()}
                    loading={test.isPending}
                  >
                    Kiểm tra kết nối đã lưu
                  </Button>
                  <Typography.Text type={verified ? 'success' : 'secondary'}>
                    {verified
                      ? 'Kết nối đã lưu đã kiểm tra thành công.'
                      : 'Kết nối đã lưu chưa được kiểm tra.'}
                  </Typography.Text>
                </Flex>
                {probe && (
                  <Alert
                    style={{ marginTop: 12 }}
                    type={CONNECTION_TEST_TONE[probe.code]}
                    showIcon
                    title={probe.message}
                  />
                )}
              </>
            )}
          </Card>

          <Card title="Lịch đồng bộ">
            <Flex gap="middle" wrap align="end">
              <Form.Item
                name="enabled"
                label="Tự động đồng bộ"
                valuePropName="checked"
              >
                <Switch disabled={mode !== 'SCHOOL_DB'} />
              </Form.Item>
              <Form.Item name="cadence" label="Tần suất">
                <Radio.Group
                  options={[
                    { value: 'DAILY', label: 'Hằng ngày' },
                    { value: 'WEEKLY', label: 'Hằng tuần' },
                  ]}
                />
              </Form.Item>
              {cadence === 'WEEKLY' && (
                <Form.Item
                  name="weekday"
                  label="Ngày trong tuần"
                  style={{ minWidth: 160 }}
                >
                  <Select
                    options={WEEKDAY_LABELS.map((label, index) => ({
                      value: index + 1,
                      label,
                    }))}
                  />
                </Form.Item>
              )}
              <Form.Item
                name="localTime"
                label="Giờ (giờ Việt Nam)"
                rules={[
                  {
                    required: true,
                    pattern: /^([01]\d|2[0-3]):[0-5]\d$/,
                    message: 'Giờ dạng HH:mm',
                  },
                ]}
              >
                <Input type="time" style={{ width: 140 }} />
              </Form.Item>
            </Flex>
            <Typography.Text type="secondary">
              {data.nextRunAt
                ? `Lần chạy tiếp theo: ${formatTime(data.nextRunAt)}.`
                : 'Chưa có lịch: tự động đồng bộ đang tắt.'}{' '}
              Dữ liệu Trường luôn được ưu tiên hơn dữ liệu Excel; giá trị cũ
              được giữ trong lịch sử xung đột.
            </Typography.Text>
          </Card>

          <Flex justify="end">
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              Lưu cấu hình
            </Button>
          </Flex>
        </Flex>
      </Form>

      <MappingCard
        revision={data.revision}
        items={mappings.data?.items}
        locked={Boolean(data.activeRunId)}
        loading={mappings.isPending}
      />
    </Flex>
  );
}

interface MappingCardProps {
  revision: number;
  items: SyncMapping[] | undefined;
  locked: boolean;
  loading: boolean;
}

// Source code -> local code, per kind. A code with no row is looked up as it is.
function MappingCard({ revision, items, locked, loading }: MappingCardProps) {
  const { message } = App.useApp();
  const save = useSaveSyncMappings();
  const [form] = Form.useForm<{ items: SyncMapping[] }>();

  useEffect(() => {
    form.setFieldsValue({ items: items ?? [] });
  }, [items, form]);

  async function onSave(values: { items?: SyncMapping[] }) {
    try {
      await save.mutateAsync({ revision, items: values.items ?? [] });
      void message.success('Đã lưu ánh xạ mã');
    } catch (error) {
      void message.error(errorMessage(error, 'Không lưu được ánh xạ.'));
    }
  }

  return (
    <Card
      title="Ánh xạ mã"
      loading={loading}
      extra={
        <Typography.Text type="secondary">
          Mã không có trong bảng được dùng nguyên văn
        </Typography.Text>
      }
    >
      <Form
        form={form}
        disabled={locked}
        onFinish={(values) => void onSave(values)}
      >
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <Flex vertical gap="small">
              {fields.length === 0 && (
                <Typography.Text type="secondary">
                  Chưa có ánh xạ: mã của Trường trùng mã trong hệ thống.
                </Typography.Text>
              )}
              {fields.map((field, index) => (
                <Flex key={field.key} gap="small" wrap align="start">
                  <Form.Item
                    name={[field.name, 'kind']}
                    rules={[{ required: true, message: 'Chọn loại' }]}
                    style={{ minWidth: 180, marginBottom: 0 }}
                  >
                    <Select
                      aria-label={`Loại mã dòng ${index + 1}`}
                      placeholder="Loại"
                      options={Object.entries(MAPPING_KIND_LABELS).map(
                        ([value, label]) => ({ value, label }),
                      )}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'sourceCode']}
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Nhập mã Trường',
                      },
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      aria-label={`Mã của Trường dòng ${index + 1}`}
                      placeholder="Mã của Trường"
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'targetCode']}
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Nhập mã hệ thống',
                      },
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      aria-label={`Mã trong hệ thống dòng ${index + 1}`}
                      placeholder="Mã trong hệ thống"
                    />
                  </Form.Item>
                  <Button onClick={() => remove(field.name)}>Xóa</Button>
                </Flex>
              ))}
              <Flex gap="small" justify="space-between">
                <Button
                  onClick={() =>
                    add({ kind: 'COURSE', sourceCode: '', targetCode: '' })
                  }
                >
                  Thêm ánh xạ
                </Button>
                <Button htmlType="submit" loading={save.isPending}>
                  Lưu ánh xạ
                </Button>
              </Flex>
            </Flex>
          )}
        </Form.List>
      </Form>
    </Card>
  );
}
