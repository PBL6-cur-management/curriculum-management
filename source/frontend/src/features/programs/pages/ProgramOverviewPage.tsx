import { Flex, Skeleton } from 'antd';
import { useParams } from 'react-router';
import { CloneProgramButton } from '../components/CloneProgramButton';
import { ProgramDirectorsSection } from '../components/ProgramDirectorsSection';
import { ProgramEditButton } from '../components/ProgramEditButton';
import { ProgramInfoCard } from '../components/ProgramInfoCard';
import { ProgramVersionsSection } from '../components/ProgramVersionsSection';
import { ProgramStatusActions } from '../components/ProgramStatusActions';
import { useProgram } from '../hooks/usePrograms';

// The program's title, menu and version choice come from ProgramWorkspaceLayout; this view is the summary.
export function ProgramOverviewPage() {
  const { programId = '' } = useParams();
  const { data: program } = useProgram(programId);
  if (!program) return <Skeleton active />;
  return (
    <Flex vertical gap="middle">
      <ProgramInfoCard
        program={program}
        actions={
          <Flex wrap gap={8}>
            <ProgramEditButton program={program} />
            {program.canClone && <CloneProgramButton program={program} />}
            {program.canManage && <ProgramStatusActions program={program} />}
          </Flex>
        }
      />
      <ProgramVersionsSection program={program} />
      <ProgramDirectorsSection program={program} />
    </Flex>
  );
}
