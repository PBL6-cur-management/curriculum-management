import { Flex, Typography } from 'antd';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import type { ProgramCohortRef, ProgramReleasedVersion } from '../api/programs';
import { NO_COHORT_LABEL } from '../constants/programLabels';

interface CohortLinksProps {
  programId: string;
  versions: ProgramReleasedVersion[];
}

const cohortLabel = ({ cohortCode, intakeYear }: ProgramCohortRef) =>
  cohortCode.includes(String(intakeYear))
    ? cohortCode
    : `${cohortCode} (${intakeYear})`;

export function CohortLinks({ programId, versions }: CohortLinksProps) {
  // Versions arrive oldest first, so a cohort attached to several keeps the newest one it follows.
  const followed = new Map<
    string,
    { cohort: ProgramCohortRef; versionId: string }
  >();
  for (const version of versions) {
    for (const cohort of version.cohorts) {
      followed.set(cohort.id, { cohort, versionId: version.id });
    }
  }
  if (!followed.size) {
    return (
      <Typography.Text type="secondary">{NO_COHORT_LABEL}</Typography.Text>
    );
  }
  const entries = [...followed.values()].sort(
    (a, b) => a.cohort.intakeYear - b.cohort.intakeYear,
  );
  return (
    <Flex vertical>
      {entries.map(({ cohort, versionId }) => (
        <Link
          key={cohort.id}
          to={generatePath(ROUTES.curriculum, { programId, versionId })}
        >
          {cohortLabel(cohort)}
        </Link>
      ))}
    </Flex>
  );
}
