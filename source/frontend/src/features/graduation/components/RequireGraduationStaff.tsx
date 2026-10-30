import type { ReactNode } from 'react';
import { Result, Skeleton } from 'antd';
import { useMe } from '../../../shared/auth/useMe';
import type { PermissionCode } from '../../../shared/auth/permissions';

interface RequireGraduationStaffProps {
  children: ReactNode;
  permission?: Extract<PermissionCode, 'graduation.view' | 'graduation.audit'>;
}
export function RequireGraduationStaff({
  children,
  permission = 'graduation.view',
}: RequireGraduationStaffProps) {
  const { data: me, isPending } = useMe();
  if (isPending) return <Skeleton active />;
  if (
    !me?.roles.some(
      (role) => role.roleCode === 'R1' || role.roleCode === 'R3',
    ) ||
    !me.permissions.includes(permission)
  )
    return (
      <Result
        status="403"
        title="Bạn không có quyền truy cập trang xét tốt nghiệp dành cho cán bộ"
      />
    );
  return children;
}
