import { Alert, Button, Flex, Result, Segmented, Select, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { PortalContext, PortalMe, PortalProgram } from '../api/portal';
import {
  ENROLLMENT_TYPE_LABELS,
  NO_PROGRAM_MESSAGE,
} from '../constants/portalLabels';
import { usePortalContext, usePortalSemesters } from '../hooks/usePortal';

interface PortalContextGateProps {
  children: (
    context: PortalContext,
    me: PortalMe,
    program: PortalProgram,
  ) => ReactNode;
}

// Program first (primary before a second major), then the calendar semester; the page below renders only for a settled context.
export function PortalContextGate({ children }: PortalContextGateProps) {
  const { me, program, programs, context, select } = usePortalContext();
  const semesters = usePortalSemesters();

  if (me.isPending) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (me.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title={errorMessage(me.error, 'Không tải được thông tin sinh viên.')}
        action={<Button onClick={() => void me.refetch()}>Thử lại</Button>}
      />
    );
  }
  if (!me.data.student) {
    return (
      <Result
        status="info"
        title="Tài khoản chưa được liên kết với hồ sơ sinh viên"
        subTitle="Liên hệ Phòng Đào tạo để được liên kết tài khoản."
      />
    );
  }

  const semesterOptions = (semesters.data ?? [])
    .filter((row) => row.startDate)
    .map((row) => ({ value: row.id, label: row.semesterCode }));

  return (
    <Flex vertical gap="middle">
      <Flex gap="small" wrap align="center">
        {programs.length > 1 && program && (
          <Segmented
            aria-label="Chương trình"
            value={program.programId}
            options={programs.map((row) => ({
              value: row.programId,
              label: `${ENROLLMENT_TYPE_LABELS[row.enrollmentType]} · ${row.programCode}`,
            }))}
            onChange={(value) => select({ program: String(value) })}
          />
        )}
        <Select
          aria-label="Học kỳ"
          style={{ minWidth: 160 }}
          loading={semesters.isPending}
          value={me.data.semester?.id}
          options={semesterOptions}
          onChange={(value: string) => select({ semester: value })}
        />
      </Flex>
      {context && program ? (
        children(context, me.data, program)
      ) : (
        <Alert type="warning" showIcon title={NO_PROGRAM_MESSAGE} />
      )}
    </Flex>
  );
}
