import { PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Flex,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import { withQuery } from '../../../shared/api/client';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { PageHeader } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import type { MajorItemExtended, MajorStatus } from '../api/majors';
import { MajorFormModal } from '../components/MajorFormModal';
import {
  DEGREE_GROUP_OPTIONS,
  DEGREE_GROUP_SHORT_LABELS,
  FACULTY_UNIT_TYPES,
  MAJOR_STATUS_COLORS,
  MAJOR_STATUS_LABELS,
} from '../constants/majorLabels';
import { useMajors, useSetMajorStatus } from '../hooks/useMajors';

export function MajorsPage() {
  const { message } = App.useApp();
  const canManage = useCan(PERMISSIONS.programEditInfo);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState('');
  const [degreeGroup, setDegreeGroup] = useState<string | undefined>();
  const [status, setStatus] = useState<MajorStatus | undefined>();
  const [facultyId, setFacultyId] = useState<string | undefined>();
  const [onlyWithPrograms, setOnlyWithPrograms] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MajorItemExtended | null>(null);

  const majors = useMajors({
    page,
    pageSize,
    q: q.trim() || undefined,
    degreeGroup,
    status,
    facultyId,
    hasPrograms: onlyWithPrograms ? true : undefined,
  });

  const statusMutation = useSetMajorStatus();

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: MajorItemExtended) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleStatusToggle = (row: MajorItemExtended) => {
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

  const columns: ColumnsType<MajorItemExtended> = [
    {
      title: 'Mã ngành',
      dataIndex: 'majorCode',
      key: 'majorCode',
      width: 120,
      render: (code: string, row) => (
        <Link to={generatePath(ROUTES.majorDetail, { majorId: row.id })}>
          <Typography.Text strong>{code}</Typography.Text>
        </Link>
      ),
    },
    {
      title: 'Tên ngành đào tạo',
      key: 'majorName',
      render: (_, row) => (
        <Flex vertical>
          <Link to={generatePath(ROUTES.majorDetail, { majorId: row.id })}>
            {row.majorName}
          </Link>
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
      width: 115,
      render: (val: string | null) =>
        val ? (
          <Tag>{DEGREE_GROUP_SHORT_LABELS[val] ?? val}</Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Khoa phụ trách',
      key: 'faculty',
      render: (_, row) =>
        row.faculty ? (
          <Tooltip title="Xem các CTĐT thuộc khoa này">
            <Link
              to={withQuery(ROUTES.programs, { facultyId: row.faculty.id })}
            >
              {row.faculty.unitName}
            </Link>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">
            Toàn trường / Chưa gán
          </Typography.Text>
        ),
    },
    {
      title: 'CTĐT',
      key: 'programCount',
      width: 135,
      align: 'right',
      render: (_, row) => {
        const programsUrl = withQuery(ROUTES.programs, {
          majorId: row.id,
          status: 'ALL',
        });
        if (row.programCount === 0) {
          return (
            <Link to={programsUrl}>
              <Typography.Text type="secondary">0</Typography.Text>
            </Link>
          );
        }
        const label =
          row.activeProgramCount !== undefined
            ? `${row.programCount} (${row.activeProgramCount} đang ĐT)`
            : `${row.programCount}`;
        return (
          <Tooltip title="Xem danh sách chương trình đào tạo thuộc ngành này">
            <Link to={programsUrl}>
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                {label}
              </Tag>
            </Link>
          </Tooltip>
        );
      },
    },
    {
      title: 'Sinh viên',
      key: 'studentCount',
      width: 90,
      align: 'right',
      render: (_, row) => {
        const count = row.studentCount ?? 0;
        return count > 0 ? (
          <Typography.Text>{count.toLocaleString('vi-VN')}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">0</Typography.Text>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: MajorStatus) => (
        <Tag color={MAJOR_STATUS_COLORS[val]}>{MAJOR_STATUS_LABELS[val]}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: canManage ? 245 : 135,
      fixed: 'right',
      render: (_: unknown, row: MajorItemExtended) => {
        const detailUrl = generatePath(ROUTES.majorDetail, { majorId: row.id });
        const programsUrl = withQuery(ROUTES.programs, {
          majorId: row.id,
          status: 'ALL',
        });
        return (
          <Space size={4}>
            <Link to={detailUrl}>
              <Button size="small">Chi tiết</Button>
            </Link>
            <Link to={programsUrl}>
              <Button size="small" type="text">
                CTĐT
              </Button>
            </Link>
            {canManage && (
              <>
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
              </>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Danh mục ngành đào tạo"
        subtitle="Cấp 0 (Level 0) — quản lý mã ngành quốc gia (Đại học, Thạc sĩ, Tiến sĩ) liên kết với các chương trình đào tạo."
        actions={
          <Space wrap size="small">
            <Link to={ROUTES.programs}>
              <Button>Danh sách CTĐT</Button>
            </Link>
            <Link to={ROUTES.reportComparison}>
              <Button>Báo cáo so sánh</Button>
            </Link>
            {canManage && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Thêm ngành
              </Button>
            )}
          </Space>
        }
      />
      <Card size="small">
        <Flex gap="small" wrap align="center">
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
              types={FACULTY_UNIT_TYPES}
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
              { value: 'ACTIVE', label: MAJOR_STATUS_LABELS.ACTIVE },
              { value: 'INACTIVE', label: MAJOR_STATUS_LABELS.INACTIVE },
            ]}
            value={status}
            onChange={(val?: MajorStatus) => {
              setStatus(val);
              setPage(1);
            }}
          />
          <Space size="small" style={{ marginInlineStart: 4 }}>
            <Switch
              id="only-with-programs-switch"
              checked={onlyWithPrograms}
              onChange={(checked) => {
                setOnlyWithPrograms(checked);
                setPage(1);
              }}
            />
            <Typography.Text>Chỉ ngành đã có CTĐT</Typography.Text>
          </Space>
        </Flex>
      </Card>
      <Table<MajorItemExtended>
        rowKey="id"
        loading={majors.isPending}
        dataSource={majors.data?.items ?? []}
        columns={columns}
        scroll={{ x: 'max-content' }}
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
      <MajorFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </Flex>
  );
}
