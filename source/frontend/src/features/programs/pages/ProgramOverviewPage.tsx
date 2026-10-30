import { Flex, Result, Skeleton, Space, Typography } from 'antd';
import { useParams } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { CloneProgramButton } from '../components/CloneProgramButton';
import { ProgramDirectorsSection } from '../components/ProgramDirectorsSection';
import { ProgramEditButton } from '../components/ProgramEditButton';
import { ProgramInfoCard } from '../components/ProgramInfoCard';
import { ProgramSectionLinks } from '../components/ProgramSectionLinks';
import { ProgramVersionsSection } from '../components/ProgramVersionsSection';
import { ProgramStatusActions } from '../components/ProgramStatusActions';
import { ProgramStatusTag } from '../components/ProgramStatusTag';
import { useProgram } from '../hooks/usePrograms';

export function ProgramOverviewPage() {
  const { programId = '' } = useParams();
  const { data: program, isPending, error } = useProgram(programId);
  if (isPending) return <Skeleton active />;
  if (!program) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <Result status="403" title="Bạn không có quyền xem chương trình này" />
      );
    return <Result status="404" title="Không tìm thấy chương trình" />;
  }
  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center" wrap gap="small">
        <Typography.Title level={2} style={{ margin: 0 }}>
          {program.programCode} — {program.currentVersionInfo.programName}{' '}
          <ProgramStatusTag status={program.status} />
        </Typography.Title>
        <Space>
          <ProgramEditButton program={program} />
          {program.canClone && <CloneProgramButton program={program} />}
          {program.canManage && <ProgramStatusActions program={program} />}
        </Space>
      </Flex>
      <ProgramSectionLinks program={program} />
      <ProgramInfoCard program={program} />
      <ProgramVersionsSection program={program} />
      <ProgramDirectorsSection program={program} />
    </Flex>
  );
}
