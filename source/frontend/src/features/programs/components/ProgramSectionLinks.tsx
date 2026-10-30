import { Button, Flex, Typography } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { useCan } from '../../../shared/auth/useCan';
import { useSeesMatrices } from '../../../shared/outcomes/useSeesMatrices';
import type { ProgramDetail } from '../api/programs';
import { versionLabel } from '../constants/programLabels';

interface ProgramSectionLinksProps {
  program: ProgramDetail;
}

// The curriculum, its elective groups and the outcomes open the version being worked on: the Draft, else the current one.
// A student sees the PLO card only; the matrices and the coverage report are staff screens (F11-05).
export function ProgramSectionLinks({ program }: ProgramSectionLinksProps) {
  const canViewOutcomes = useCan('outcome.view');
  const seesMatrices = useSeesMatrices();
  const canViewHistory = useCan('version.viewHistory');
  const workingVersion = program.draftVersion ?? program.currentVersion;
  const params = { programId: program.id, versionId: workingVersion.id };
  const sections = [
    {
      title: 'Khung chương trình',
      to: generatePath(ROUTES.curriculum, params),
    },
    {
      title: 'Nhóm tự chọn',
      to: generatePath(ROUTES.electiveGroups, params),
    },
    {
      title: 'Kiểm tra nhất quán',
      to: generatePath(ROUTES.consistency, params),
    },
    ...(canViewOutcomes
      ? [{ title: 'PLO', to: generatePath(ROUTES.plos, params) }]
      : []),
    ...(seesMatrices
      ? [
          {
            title: 'Ma trận học phần–PLO',
            to: generatePath(ROUTES.coursePloMatrix, params),
          },
          {
            title: 'Ma trận CLO–PLO',
            to: generatePath(ROUTES.cloPloMatrix, params),
          },
          {
            title: 'Kiểm tra phủ chuẩn đầu ra',
            to: generatePath(ROUTES.outcomeCoverage, params),
          },
          {
            title: 'Đồ thị học phần',
            to: generatePath(ROUTES.courseGraph, params),
          },
          {
            title: 'Sức khỏe chương trình',
            to: generatePath(ROUTES.programHealth, params),
          },
        ]
      : []),
    ...(canViewHistory && seesMatrices
      ? [
          {
            title: 'Dòng thời gian phiên bản',
            to: generatePath(ROUTES.versionTimeline, {
              programId: program.id,
            }),
          },
        ]
      : []),
  ];
  return (
    <Flex
      vertical
      gap={8}
      data-program-id={program.id}
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'var(--ctdt-color-fill-quaternary)',
      }}
    >
      <Typography.Text type="secondary">
        Làm việc trên phiên bản {versionLabel(workingVersion)}
      </Typography.Text>
      <Flex wrap gap={8}>
        {sections.map(({ title, to }, index) => (
          <Link key={title} to={to} aria-label={title}>
            <Button type={index === 0 ? 'primary' : 'default'} tabIndex={-1}>
              {title}
            </Button>
          </Link>
        ))}
      </Flex>
    </Flex>
  );
}
