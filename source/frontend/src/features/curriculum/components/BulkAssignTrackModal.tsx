import {
  App,
  Button,
  Checkbox,
  Flex,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  BulkAssignTrackMode,
  Curriculum,
  CurriculumItem,
} from '../api/curriculum';
import { useBulkAssignTrackItems } from '../hooks/useCurriculum';

interface BulkAssignTrackModalProps {
  curriculum: Curriculum;
  initialItemIds?: string[];
  onClose: () => void;
  onSuccess?: () => void;
}

type KindChoice = 'KEEP' | 'COMPULSORY' | 'ELECTIVE';

const lower = (text: string) => text.toLocaleLowerCase('vi');

export function BulkAssignTrackModal({
  curriculum,
  initialItemIds,
  onClose,
  onSuccess,
}: BulkAssignTrackModalProps) {
  const { message } = App.useApp();
  const assign = useBulkAssignTrackItems(curriculum.version.id);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    initialItemIds ?? [],
  );
  const [search, setSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<string>('ALL');
  const [toCommon, setToCommon] = useState(false);
  const [targetTrackIds, setTargetTrackIds] = useState<string[]>([]);
  const [mode, setMode] = useState<BulkAssignTrackMode>('MOVE');
  const [kind, setKind] = useState<KindChoice>('KEEP');

  const visible = useMemo(() => {
    const needle = lower(search.trim());
    return curriculum.items.filter(
      (row) =>
        (needle === '' ||
          lower(row.course.courseCode).includes(needle) ||
          lower(row.course.courseName).includes(needle)) &&
        (trackFilter === 'ALL' ||
          (trackFilter === 'COMMON'
            ? row.track === null
            : row.track?.id === trackFilter)),
    );
  }, [curriculum.items, search, trackFilter]);

  const columns: TableColumnsType<CurriculumItem> = [
    { title: 'Mã HP', render: (_v, row) => row.course.courseCode, width: 100 },
    { title: 'Tên học phần', render: (_v, row) => row.course.courseName },
    { title: 'HK', dataIndex: 'plannedSemester', align: 'center', width: 56 },
    {
      title: 'Loại',
      width: 90,
      render: (_v, row) => (row.isElective ? 'Tự chọn' : 'Bắt buộc'),
    },
    {
      title: 'Chuyên ngành',
      width: 130,
      render: (_v, row) =>
        row.track ? (
          <Tag color="geekblue">{row.track.trackCode}</Tag>
        ) : (
          <Tag>Khung chung</Tag>
        ),
    },
  ];

  const canSubmit =
    selectedItemIds.length > 0 && (toCommon || targetTrackIds.length > 0);

  const submit = () => {
    assign.mutate(
      {
        itemIds: selectedItemIds,
        trackIds: toCommon ? [] : targetTrackIds,
        mode: toCommon ? 'MOVE' : mode,
        ...(kind !== 'KEEP' ? { isElective: kind === 'ELECTIVE' } : {}),
      },
      {
        onSuccess: (res) => {
          void message.success(
            `Đã cập nhật ${res.updated}, tạo mới ${res.created}, bỏ qua ${res.skipped} học phần.`,
          );
          onSuccess?.();
          onClose();
        },
        onError: (err) => {
          void message.error(
            errorMessage(err, 'Không gán được học phần vào chuyên ngành.'),
          );
        },
      },
    );
  };

  return (
    <Modal
      open
      title="Gán học phần vào chuyên ngành"
      width={760}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            type="primary"
            disabled={!canSubmit}
            loading={assign.isPending}
            onClick={submit}
          >
            Gán
          </Button>
        </Space>
      }
    >
      <Flex vertical gap="middle">
        <Typography.Text strong>1. Chọn học phần</Typography.Text>
        <Flex wrap gap="small" align="center">
          <Input
            allowClear
            style={{ width: 260 }}
            placeholder="Tìm mã hoặc tên học phần..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            style={{ width: 200 }}
            aria-label="Lọc theo chuyên ngành hiện tại"
            value={trackFilter}
            onChange={setTrackFilter}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'COMMON', label: 'Khung chung' },
              ...curriculum.tracks.map((t) => ({
                value: t.id,
                label: t.trackCode,
              })),
            ]}
          />
          <Button
            size="small"
            onClick={() =>
              setSelectedItemIds((current) => [
                ...new Set([...current, ...visible.map((row) => row.id)]),
              ])
            }
          >
            Chọn tất cả đang hiện
          </Button>
          <Button size="small" onClick={() => setSelectedItemIds([])}>
            Bỏ chọn
          </Button>
          <Tag color="blue">Đã chọn {selectedItemIds.length} học phần</Tag>
        </Flex>
        <Table<CurriculumItem>
          size="small"
          rowKey="id"
          pagination={false}
          scroll={{ y: 240 }}
          columns={columns}
          dataSource={visible}
          rowSelection={{
            selectedRowKeys: selectedItemIds,
            preserveSelectedRowKeys: true,
            onChange: (keys) => setSelectedItemIds(keys.map(String)),
          }}
        />
        <Typography.Text strong>2. Chuyên ngành đích và chế độ</Typography.Text>
        <Checkbox
          checked={toCommon}
          onChange={(e) => {
            setToCommon(e.target.checked);
            if (e.target.checked) setMode('MOVE');
          }}
        >
          Đưa về Khung chung (bỏ gán chuyên ngành)
        </Checkbox>
        {!toCommon && (
          <>
            <Select
              mode="multiple"
              aria-label="Chuyên ngành đích"
              placeholder="Chọn một hoặc nhiều chuyên ngành đích"
              value={targetTrackIds}
              onChange={setTargetTrackIds}
              options={curriculum.tracks.map((t) => ({
                value: t.id,
                label: `${t.trackCode} — ${t.trackName}`,
              }))}
            />
            <Radio.Group
              value={mode}
              onChange={(e) => setMode(e.target.value as BulkAssignTrackMode)}
            >
              <Flex vertical gap={4}>
                <Radio value="MOVE">
                  Chuyển sang chuyên ngành đã chọn
                  <Typography.Text type="secondary">
                    {' '}
                    (di chuyển dòng hiện tại sang chuyên ngành đầu tiên; nếu
                    chọn nhiều chuyên ngành sẽ tự nhân bản sang các chuyên
                    ngành còn lại)
                  </Typography.Text>
                </Radio>
                <Radio value="COPY">
                  Sao chép thêm sang chuyên ngành đã chọn
                  <Typography.Text type="secondary">
                    {' '}
                    (giữ nguyên dòng gốc, tạo bản sao ở các chuyên ngành đích —
                    phù hợp HP dùng chung nhiều chuyên ngành)
                  </Typography.Text>
                </Radio>
              </Flex>
            </Radio.Group>
          </>
        )}
        <Flex align="center" gap="small">
          <span>Loại học phần sau khi gán:</span>
          <Select<KindChoice>
            style={{ width: 160 }}
            aria-label="Loại học phần sau khi gán"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'KEEP', label: 'Giữ nguyên' },
              { value: 'COMPULSORY', label: 'Bắt buộc' },
              { value: 'ELECTIVE', label: 'Tự chọn' },
            ]}
          />
        </Flex>
      </Flex>
    </Modal>
  );
}
