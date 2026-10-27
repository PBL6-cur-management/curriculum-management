import { Alert, Button, Skeleton, Typography } from 'antd';
import { useState } from 'react';
import { generatePath, Link, useParams, useSearchParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { DetailPageLayout } from '../../../shared/design-system/DetailPageLayout';
import { PageHeader } from '../../../shared/design-system/PageHeader';
import { AppliedCohortVersionPanel } from '../components/AppliedCohortVersionPanel';
import { CohortAssignmentProgramPicker } from '../components/CohortAssignmentProgramPicker';
import { CohortVersionAssignmentForm } from '../components/CohortVersionAssignmentForm';
import { CohortVersionAssignmentsTable } from '../components/CohortVersionAssignmentsTable';
import { ReleaseQueryError } from '../components/VersionComparisonSections';
import {
  ASSIGNMENT_NOTE,
  STUDENT_ASSIGNMENT_NOTE,
} from '../constants/releaseLabels';
import { useCohortVersions, useVersionHistory } from '../hooks/useReleases';

function ProgramCohortAssignments({ programId }: { programId: string }) {
  const schedule = useCohortVersions(programId);
  const history = useVersionHistory(programId);
  const [search] = useSearchParams();
  const initialCohortId = search.get('cohortId') ?? undefined;
  const [dialog, setDialog] = useState<{ assignmentId?: string } | null>(null);
  return (
    <DetailPageLayout>
      <Link to={generatePath(ROUTES.programDetail, { programId })}>
        ← Chương trình
      </Link>
      <PageHeader
        title="Gán phiên bản cho khóa"
        actions={
          <Button
            type="primary"
            disabled={
              !schedule.data ||
              !history.data ||
              Boolean(schedule.error || history.error)
            }
            onClick={() => setDialog({})}
          >
            Gán phiên bản
          </Button>
        }
      />
      <Alert type="info" showIcon title={ASSIGNMENT_NOTE} />
      <Typography.Text type="secondary">
        {STUDENT_ASSIGNMENT_NOTE}
      </Typography.Text>
      {schedule.error ? (
        <ReleaseQueryError
          error={schedule.error}
          retry={() => void schedule.refetch()}
        />
      ) : schedule.isPending ? (
        <Skeleton active />
      ) : (
        schedule.data && (
          <CohortVersionAssignmentsTable
            programId={programId}
            assignments={schedule.data.assignments}
            onEdit={(assignmentId) => setDialog({ assignmentId })}
          />
        )
      )}
      {history.error && (
        <ReleaseQueryError
          error={history.error}
          retry={() => void history.refetch()}
        />
      )}
      <AppliedCohortVersionPanel
        programId={programId}
        initialCohortId={initialCohortId}
      />
      {dialog && schedule.data && history.data && (
        <CohortVersionAssignmentForm
          key={dialog.assignmentId ?? 'create'}
          assignments={schedule.data}
          versions={history.data.versions}
          assignmentId={dialog.assignmentId}
          initialCohortId={initialCohortId}
          onCancel={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      )}
    </DetailPageLayout>
  );
}
export function CohortVersionAssignmentsPage() {
  const { programId } = useParams();
  return programId ? (
    <ProgramCohortAssignments key={programId} programId={programId} />
  ) : (
    <CohortAssignmentProgramPicker />
  );
}
