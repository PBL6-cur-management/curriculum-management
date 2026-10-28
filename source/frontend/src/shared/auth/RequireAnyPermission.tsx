import { Result } from 'antd';
import type { ReactNode } from 'react';
import { hasPermission, type PermissionCode } from './permissions';
import { useMe } from './useMe';

interface RequireAnyPermissionProps {
  codes: readonly PermissionCode[];
  children: ReactNode;
}

// An empty list denies: "any of nothing" must never open a route.
export function RequireAnyPermission({
  codes,
  children,
}: RequireAnyPermissionProps) {
  const { data: me } = useMe();
  if (!codes.some((code) => hasPermission(me, code))) {
    return (
      <Result status="403" title="Bạn không có quyền truy cập trang này" />
    );
  }
  return children;
}
