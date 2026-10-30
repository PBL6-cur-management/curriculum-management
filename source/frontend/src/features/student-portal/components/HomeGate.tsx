import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { ROUTES } from '../../../routes';
import { useMe } from '../../../shared/auth/useMe';

const STUDENT_ROLE = 'R6';

function roleCodes(roles: { roleCode: string }[] | undefined) {
  return new Set(roles?.map((role) => role.roleCode) ?? []);
}

// A student-only account lands in the portal; anyone holding a staff role keeps the staff home.
export function HomeGate({ staffHome }: { staffHome: ReactNode }) {
  const { data: me } = useMe();
  const roles = roleCodes(me?.roles);
  if (roles.size === 1 && roles.has(STUDENT_ROLE)) {
    return <Navigate to={ROUTES.studentPortal} replace />;
  }
  return staffHome;
}

// The portal reads the session's own student record, so only a student role may open it.
export function RequireStudent({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  if (!roleCodes(me?.roles).has(STUDENT_ROLE)) {
    return <Navigate to={ROUTES.home} replace />;
  }
  return children;
}
