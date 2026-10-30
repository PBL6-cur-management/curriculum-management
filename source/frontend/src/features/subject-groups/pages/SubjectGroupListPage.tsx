import { useState } from 'react';
import { App, Button, Card, Result, Select, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import { useCan } from '../../../shared/auth/useCan';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import {
  type SubjectGroupListParams,
  type SubjectGroupSummary,
} from '../../../shared/subject-groups/subjectGroups';
import { useSubjectGroups } from '../../../shared/subject-groups/useSubjectGroups';
import { CoordinatorCell } from '../components/CoordinatorCell';
import { SubjectGroupFormModal } from '../components/SubjectGroupFormModal';
import { DeactivateGroupModal } from '../components/DeactivateGroupModal';
import { useActivateSubjectGroup } from '../hooks/useSubjectGroupAdmin';
import {
  GROUP_STATUS_COLORS,
  GROUP_STATUS_LABELS,
} from '../constants/subjectGroupLabels';
import { PageHeader } from '../../../shared/design-system';

export function SubjectGroupListPage() {
  const canManage = useCan(PERMISSIONS.orgUnitManage);
  const [params, setParams] = useState<SubjectGroupListParams>({});
  const [editing, setEditing] = useState<SubjectGroupSummary | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<SubjectGroupSummary | null>(
    null,
  );
  const { message } = App.useApp();
  const { data = [], isPending, isError } = useSubjectGroups(params);
  const activate = useActivateSubjectGroup();
  async function activateGroup(group: SubjectGroupSummary) {
    try {
      await activate.mutateAsync(group.id);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'Không thể kích hoạt nhóm',
      );
    }
  }
  const columns: TableColumnsType<SubjectGroupSummary> = [
    { title: 'Mã nhóm', dataIndex: 'groupCode' },
    {
      title: 'Tên nhóm',
      render: (_value, group) => (
        <Link
          to={generatePath(ROUTES.subjectGroupDetail, { groupId: group.id })}
        >
          {group.groupName}
        </Link>
      ),
    },
    { title: 'Khoa', render: (_value, group) => group.faculty.unitName },
    { title: 'Thành viên', dataIndex: 'activeMemberCount' },
    {
      title: 'Điều phối',
      render: (_value, group) => <CoordinatorCell group={group} />,
    },
    {
      title: 'Trạng thái',
      render: (_value, group) => (
        <Tag color={GROUP_STATUS_COLORS[group.status]}>
          {GROUP_STATUS_LABELS[group.status]}
        </Tag>
      ),
    },
    ...(canManage
      ? [
          {
            title: 'Thao tác',
            render: (_: unknown, group: SubjectGroupSummary) => (
              <>
                {
                  <Button
                    type="link"
                    onClick={() => {
                      setEditing(group);
                      setFormOpen(true);
                    }}
                  >
                    Sửa
                  </Button>
                }
                {group.status === 'ACTIVE' ? (
                  <Button
                    type="link"
                    danger
                    onClick={() => setDeactivating(group)}
                  >
                    Ngừng sử dụng
                  </Button>
                ) : (
                  <Button type="link" onClick={() => void activateGroup(group)}>
                    Kích hoạt lại
                  </Button>
                )}
              </>
            ),
          },
        ]
      : []),
  ];
  if (isError)
    return <Result status="error" title="Không tải được nhóm chuyên môn" />;
  return (
    <>
      <PageHeader
        title="Nhóm chuyên môn"
        actions={
          canManage && (
            <Button
              type="primary"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              Thêm nhóm
            </Button>
          )
        }
      />
      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <OrgUnitSelect
            types={['FACULTY']}
            value={params.facultyId}
            onChange={(facultyId) =>
              setParams((current) => ({
                ...current,
                facultyId: facultyId ?? undefined,
              }))
            }
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            value={params.status}
            onChange={(status) =>
              setParams((current) => ({ ...current, status }))
            }
            options={Object.entries(GROUP_STATUS_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
          />
        </div>
        <Table
          rowKey="id"
          loading={isPending}
          columns={columns}
          dataSource={data}
          locale={{ emptyText: 'Chưa có nhóm chuyên môn' }}
        />
      </Card>
      <SubjectGroupFormModal
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
      />
      <DeactivateGroupModal
        group={deactivating}
        onClose={() => setDeactivating(null)}
      />
    </>
  );
}
