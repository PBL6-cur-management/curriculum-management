import { Result } from 'antd';
import type { ReactNode } from 'react';
import { RequirePermission } from '../../../shared/auth/RequirePermission';
import { useMe } from '../../../shared/auth/useMe';

interface RequireStudentStaffProps {
  children: ReactNode;
}
export function RequireStudentStaff({ children }: RequireStudentStaffProps) {
  const { data: me } = useMe();
  if (
    !me?.roles.some((role) => role.roleCode === 'R1' || role.roleCode === 'R3')
  )
    return (
      <Result
        status="403"
        title="Bạn không có quyền truy cập hồ sơ sinh viên"
      />
    );
  return (
    <RequirePermission code="student.viewProgress">
      {children}
    </RequirePermission>
  );
}
