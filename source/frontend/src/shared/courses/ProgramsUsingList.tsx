import { Flex, Typography } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../routes';
import type { components } from '../api/schema';
import { versionLabel } from '../constants/versionLabels';
import { NOT_USED_BY_PROGRAMS } from './courseUsageLabels';

type CourseUsage = components['schemas']['CourseUsageDto'];

interface ProgramsUsingListProps {
  programs: CourseUsage[];
}

// One line per program version still in play, with the semester the course is planned in (FR-17, US-028).
export function ProgramsUsingList({ programs }: ProgramsUsingListProps) {
  if (programs.length === 0)
    return (
      <Typography.Text type="secondary">{NOT_USED_BY_PROGRAMS}</Typography.Text>
    );
  // A plain list: AntD List is deprecated in v6 and adds nothing here.
  return (
    <Flex
      component="ul"
      vertical
      gap={6}
      style={{ margin: 0, paddingInlineStart: 0, listStyle: 'none' }}
    >
      {programs.map((program) => (
        <li key={`${program.programId}:${program.versionLabel ?? 'draft'}`}>
          <Link
            to={generatePath(ROUTES.programDetail, {
              programId: program.programId,
            })}
          >
            {program.programCode} — {program.programName}
          </Link>
          <Typography.Text type="secondary">
            {` (${versionLabel({ versionNumber: program.versionLabel })}, học kỳ ${program.plannedSemester})`}
          </Typography.Text>
        </li>
      ))}
    </Flex>
  );
}
