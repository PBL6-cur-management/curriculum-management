import { useState } from 'react';
import { Alert, App, Button, Card, Popconfirm, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  formatPeriod,
  VALIDITY_STATE_COLORS,
  VALIDITY_STATE_LABELS,
  type ValidityState,
} from '../../../shared/validity/validity';
import type { ProgramDetail, ProgramDirector } from '../api/programs';
import { REVOKE_DIRECTOR_CONFIRM } from '../constants/programLabels';
import { useProgramDirectors, useRevokeDirector } from '../hooks/usePrograms';
import { AssignDirectorModal } from './AssignDirectorModal';
import { EndDirectorModal } from './EndDirectorModal';

interface ProgramDirectorsSectionProps {
  program: ProgramDetail;
}

// Active rows first, then upcoming, then the history the program keeps (US-020 AC2).
const STATE_ORDER: Record<ValidityState, number> = {
  ACTIVE: 0,
  SCHEDULED: 1,
  EXPIRED: 2,
  REVOKED: 3,
};
const EDITABLE_STATES: readonly ValidityState[] = ['ACTIVE', 'SCHEDULED'];

export function ProgramDirectorsSection({
  program,
}: ProgramDirectorsSectionProps) {
  const { message } = App.useApp();
  const { data, isPending, isError } = useProgramDirectors(program.id);
  const revoke = useRevokeDirector();
  const [assigning, setAssigning] = useState(false);
  const [ending, setEnding] = useState<ProgramDirector | null>(null);
  const canAssign = program.canManage && program.status === 'ACTIVE';
  const rows = [...(data ?? [])].sort(
    (left, right) => STATE_ORDER[left.state] - STATE_ORDER[right.state],
  );
  const revokeRow = (row: ProgramDirector) =>
    revoke.mutate(
      { programId: program.id, assignmentId: row.id },
      {
        onError: (error) =>
          void message.error(
            error instanceof Error
              ? error.message
              : 'Không thu hồi được phân công.',
          ),
      },
    );
  const columns: TableColumnsType<ProgramDirector> = [
    { title: 'Họ tên', render: (_value, row) => row.director.fullName },
    {
      title: 'Thời hạn',
      render: (_value, row) => formatPeriod(row.validFrom, row.validTo),
    },
    {
      title: 'Trạng thái',
      render: (_value, row) => (
        <Tag color={VALIDITY_STATE_COLORS[row.state]}>
          {VALIDITY_STATE_LABELS[row.state]}
        </Tag>
      ),
    },
    {
      title: 'Người phân công',
      render: (_value, row) => row.assignedBy?.fullName ?? '—',
    },
    ...(program.canManage
      ? [
          {
            title: 'Thao tác',
            render: (_value: unknown, row: ProgramDirector) =>
              EDITABLE_STATES.includes(row.state) ? (
                <>
                  <Button type="link" onClick={() => setEnding(row)}>
                    Kết thúc
                  </Button>
                  <Popconfirm
                    title={REVOKE_DIRECTOR_CONFIRM}
                    okText="Thu hồi"
                    onConfirm={() => revokeRow(row)}
                  >
                    <Button type="link" danger>
                      Thu hồi
                    </Button>
                  </Popconfirm>
                </>
              ) : null,
          },
        ]
      : []),
  ];
  return (
    <Card
      title="Giám đốc CTĐT"
      extra={
        canAssign && (
          <Button onClick={() => setAssigning(true)}>Phân công</Button>
        )
      }
    >
      {isError && (
        <Alert
          type="error"
          showIcon
          title="Không tải được danh sách Giám đốc CTĐT."
        />
      )}
      <Table<ProgramDirector>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={isPending}
        pagination={false}
        locale={{ emptyText: 'Chưa phân công Giám đốc CTĐT' }}
      />
      {assigning && (
        <AssignDirectorModal
          program={program}
          onClose={() => setAssigning(false)}
        />
      )}
      {ending && (
        <EndDirectorModal
          programId={program.id}
          row={ending}
          onClose={() => setEnding(null)}
        />
      )}
    </Card>
  );
}
