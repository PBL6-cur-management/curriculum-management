import { Button, Card, Flex, Table, Tag } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import type { ProgramDetail, ProgramVersionRef } from '../api/programs';
import {
  VERSION_STATUS_LABELS,
  versionLabel,
} from '../constants/programLabels';

interface ProgramVersionsSectionProps {
  program: ProgramDetail;
}

// The versions of a program, and the way to the release (R1, the first Draft only) and to the history (MH-46).
// A released version opens its read-only detail (MH-47); the Draft opens the curriculum it is still built in.
export function ProgramVersionsSection({
  program,
}: ProgramVersionsSectionProps) {
  const canPublish = useCan(PERMISSIONS.versionPublish);
  const canAssign = useCan(PERMISSIONS.versionAssignCohort);
  const neverReleased = program.versions.every(
    (version) => version.status === 'DRAFT',
  );
  const draft = program.draftVersion;
  return (
    <Card
      title="Phiên bản"
      extra={
        <Flex gap="small" wrap>
          {canPublish && neverReleased && draft && (
            <Link
              to={generatePath(ROUTES.versionRelease, {
                programId: program.id,
                versionId: draft.id,
              })}
            >
              <Button type="primary">Ban hành phiên bản đầu tiên</Button>
            </Link>
          )}
          {canAssign && (
            <Link
              to={generatePath(ROUTES.cohortVersionAssignments, {
                programId: program.id,
              })}
            >
              Gán phiên bản cho khóa
            </Link>
          )}
          <Link
            to={generatePath(ROUTES.versionHistory, { programId: program.id })}
          >
            Lịch sử phiên bản
          </Link>
        </Flex>
      }
    >
      <Table<ProgramVersionRef>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={program.versions}
        columns={[
          {
            title: 'Phiên bản',
            key: 'version',
            render: (_: unknown, version) => (
              <Link
                to={generatePath(
                  version.status === 'DRAFT'
                    ? ROUTES.curriculum
                    : ROUTES.versionDetail,
                  { programId: program.id, versionId: version.id },
                )}
              >
                {versionLabel(version)}
              </Link>
            ),
          },
          {
            title: 'Trạng thái',
            key: 'status',
            render: (_: unknown, version) => (
              <Tag>{VERSION_STATUS_LABELS[version.status]}</Tag>
            ),
          },
        ]}
      />
    </Card>
  );
}
