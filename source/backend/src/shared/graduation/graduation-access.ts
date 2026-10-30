import type { AccessContext, ScopeTarget } from '../authz/access-context.js';
import { PERMISSIONS } from '../authz/permission-codes.js';
import { AppException } from '../exception/app.exception.js';
import { COMMON_ERRORS } from '../exception/error-codes.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import { STUDENT_ROLES } from '../students/student.constants.js';

export function assertGraduationRead(
  access: AccessContext,
  target: ScopeTarget,
): void {
  assertGrant(access, target, false);
}

export function assertGraduationWrite(
  access: AccessContext,
  target: ScopeTarget,
): void {
  assertGrant(access, target, true);
}

export function graduationStaffScope(
  access: AccessContext,
  write = false,
): { all: true } | { all: false; programIds: string[] } {
  const code = write
    ? PERMISSIONS.GRADUATION_AUDIT
    : PERMISSIONS.GRADUATION_VIEW;
  const programs = new Set<string>();
  let held = false;
  for (const assignment of access.assignments) {
    const grant = assignment.permissions.get(code);
    if (
      !grant ||
      (write && grant.mode !== 'DIRECT') ||
      (assignment.roleCode !== STUDENT_ROLES.OFFICE &&
        assignment.roleCode !== STUDENT_ROLES.DIRECTOR)
    )
      continue;
    held = true;
    if (
      assignment.scope.all ||
      (assignment.roleCode === STUDENT_ROLES.OFFICE && grant.scope === 'ALL')
    )
      return { all: true };
    assignment.scope.programIds.forEach((id) => programs.add(id));
  }
  if (!held) throw new AppException(COMMON_ERRORS.PERMISSION_DENIED);
  return { all: false, programIds: [...programs].sort() };
}

function assertGrant(
  access: AccessContext,
  target: ScopeTarget,
  write: boolean,
): void {
  const code = write
    ? PERMISSIONS.GRADUATION_AUDIT
    : PERMISSIONS.GRADUATION_VIEW;
  for (const assignment of access.assignments) {
    const grant = assignment.permissions.get(code);
    if (!grant || (write && grant.mode !== 'DIRECT')) continue;
    if (assignment.roleCode === STUDENT_ROLES.OFFICE) {
      if (
        grant.scope === 'ALL' ||
        assignment.scope.all ||
        target.programIds?.some(
          (id) => !assignment.scope.all && assignment.scope.programIds.has(id),
        )
      )
        return;
    }
    if (
      assignment.roleCode === STUDENT_ROLES.DIRECTOR &&
      (assignment.scope.all ||
        target.programIds?.some(
          (id) => !assignment.scope.all && assignment.scope.programIds.has(id),
        ))
    )
      return;
    if (
      !write &&
      assignment.roleCode === STUDENT_ROLES.SELF &&
      (assignment.scope.all ||
        target.studentIds?.some(
          (id) => !assignment.scope.all && assignment.scope.studentIds.has(id),
        ))
    )
      return;
  }
  throw new AppException(
    access.has(code)
      ? GRADUATION_ERRORS.ACCESS_REVOKED
      : COMMON_ERRORS.PERMISSION_DENIED,
  );
}
