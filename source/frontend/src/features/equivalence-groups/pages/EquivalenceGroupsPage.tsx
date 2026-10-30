import {
  App,
  Button,
  Card,
  Input,
  Result,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { Link, generatePath, useSearchParams } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../../../shared/api/pagination';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCanEditSchoolWide } from '../../../shared/auth/useCan';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  EquivalenceGroup,
  EquivalenceGroupQuery,
} from '../api/equivalenceGroups';
import {
  AddMemberModal,
  type OtherGroupRef,
} from '../components/AddMemberModal';
import { EquivalenceGroupFormModal } from '../components/EquivalenceGroupFormModal';
import { MergeGroupsModal } from '../components/MergeGroupsModal';
import {
  useDissolveEquivalenceGroup,
  useEquivalenceGroupList,
  useRemoveEquivalenceMember,
} from '../hooks/useEquivalenceGroups';
import { formatEmpty } from '../../../shared/design-system';

export const DISSOLVE_CONFIRM_TEXT =
  'Các học phần trong nhóm sẽ không còn tương đương với nhau. Thao tác này không hoàn tác được.';

type Dialog =
  | { kind: 'form'; group?: EquivalenceGroup }
  | { kind: 'add'; group: EquivalenceGroup }
  | { kind: 'merge'; group: EquivalenceGroup; otherGroup?: OtherGroupRef };

export function EquivalenceGroupsPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState<EquivalenceGroupQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    q: searchParams.get('q') ?? undefined,
  });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { data, isFetching, error } = useEquivalenceGroupList(query);
  const canEdit = useCanEditSchoolWide(PERMISSIONS.courseRelationEdit);
  const { modal, message } = App.useApp();
  const removeMember = useRemoveEquivalenceMember();
  const dissolve = useDissolveEquivalenceGroup();

  const confirmRemove = (group: EquivalenceGroup, courseId: string) => {
    const member = group.members.find((item) => item.id === courseId);
    modal.confirm({
      title: `Bỏ ${member?.courseCode ?? 'học phần'} khỏi nhóm ${group.groupCode}?`,
      okText: 'Bỏ khỏi nhóm',
      cancelText: 'Hủy',
      onOk: () =>
        removeMember
          .mutateAsync({ groupId: group.id, courseId })
          .catch((reason: unknown) => {
            void message.error(
              errorMessage(reason, 'Không bỏ được học phần khỏi nhóm.'),
            );
          }),
    });
  };
  const confirmDissolve = (group: EquivalenceGroup) =>
    modal.confirm({
      title: `Giải thể nhóm ${group.groupCode}?`,
      content: DISSOLVE_CONFIRM_TEXT,
      okText: 'Giải thể nhóm',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () =>
        dissolve.mutateAsync(group.id).catch((reason: unknown) => {
          void message.error(errorMessage(reason, 'Không giải thể được nhóm.'));
        }),
    });

  const columns: TableColumnsType<EquivalenceGroup> = [
    { title: 'Mã nhóm', dataIndex: 'groupCode' },
    {
      title: 'Học phần',
      render: (_value, group) => (
        <Space size={[4, 4]} wrap>
          {group.members.map((member) => (
            <Tooltip key={member.id} title={member.courseName}>
              <Tag
                closable={canEdit}
                onClose={(event) => {
                  event.preventDefault();
                  confirmRemove(group, member.id);
                }}
              >
                <Link
                  to={generatePath(ROUTES.courseDetail, {
                    courseId: member.id,
                  })}
                >
                  {member.courseCode}
                </Link>
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      render: (note: string | null) => formatEmpty(note, 'Không có'),
    },
    ...(canEdit
      ? [
          {
            title: 'Thao tác',
            render: (_: unknown, group: EquivalenceGroup) => (
              <Space size={0} wrap>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setDialog({ kind: 'add', group })}
                >
                  Thêm học phần
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setDialog({ kind: 'merge', group })}
                >
                  Gộp với nhóm…
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setDialog({ kind: 'form', group })}
                >
                  Sửa
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => confirmDissolve(group)}
                >
                  Giải thể
                </Button>
              </Space>
            ),
          },
        ]
      : []),
  ];

  if (error && !data)
    return (
      <Result
        status="error"
        title={errorMessage(error, 'Không tải được nhóm tương đương')}
      />
    );
  return (
    <>
      <Card
        title="Nhóm học phần tương đương"
        extra={
          canEdit && (
            <Button type="primary" onClick={() => setDialog({ kind: 'form' })}>
              Tạo nhóm
            </Button>
          )
        }
      >
        <Input.Search
          allowClear
          defaultValue={query.q}
          placeholder="Tìm theo mã nhóm hoặc mã học phần"
          onSearch={(q) => setQuery({ ...query, q: q || undefined, page: 1 })}
          style={{ maxWidth: 420, marginBottom: 16 }}
        />
        <Table
          rowKey="id"
          loading={isFetching}
          columns={columns}
          dataSource={data?.items ?? []}
          locale={{ emptyText: 'Chưa có nhóm tương đương' }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: data?.total ?? 0,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showSizeChanger: true,
            onChange: (page, pageSize) =>
              setQuery({ ...query, page, pageSize }),
          }}
        />
      </Card>
      {dialog?.kind === 'form' && (
        <EquivalenceGroupFormModal
          group={dialog.group}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'add' && (
        <AddMemberModal
          group={dialog.group}
          onClose={() => setDialog(null)}
          onMerge={(otherGroup) =>
            setDialog({ kind: 'merge', group: dialog.group, otherGroup })
          }
        />
      )}
      {dialog?.kind === 'merge' && (
        <MergeGroupsModal
          group={dialog.group}
          otherGroup={dialog.otherGroup}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
