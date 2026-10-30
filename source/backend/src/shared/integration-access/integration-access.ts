import { AccessContext } from '../authz/access-context.js';
import type { PermissionGrant } from '../authz/access-context.js';
import { PERMISSIONS, type PermissionCode } from '../authz/permission-codes.js';
import { INTEGRATION } from './integration.constants.js';

const READ: PermissionGrant = { mode: 'DIRECT', scope: 'SCOPED' };

// A partner server is not a user: it gets one synthetic assignment bound to the single student a call names,
// with read-only grants, so every shared reader's own checks still decide (F-21 BE-04).
export function integrationAccess(
  clientId: string,
  studentId: string,
): AccessContext {
  const permissions = new Map<PermissionCode, PermissionGrant>([
    [PERMISSIONS.STUDENT_VIEW_PROGRESS, READ],
    [PERMISSIONS.STUDENT_VIEW_REGISTRATION_ELIGIBILITY, READ],
    [PERMISSIONS.GRADUATION_VIEW, READ],
  ]);
  return new AccessContext(`integration:${clientId}`, [
    {
      assignmentId: null,
      roleId: INTEGRATION.ROLE_CODE,
      roleCode: INTEGRATION.ROLE_CODE,
      roleName: 'Bên tích hợp',
      scopeSource: 'NONE',
      scopeType: 'ASSIGNMENT',
      scopeUnit: null,
      scope: {
        all: false,
        orgUnitIds: new Set(),
        subjectGroupIds: new Set(),
        programIds: new Set(),
        studentIds: new Set([studentId]),
      },
      permissions,
    },
  ]);
}

export function isIntegrationAssignment(roleCode: string): boolean {
  return roleCode === INTEGRATION.ROLE_CODE;
}
