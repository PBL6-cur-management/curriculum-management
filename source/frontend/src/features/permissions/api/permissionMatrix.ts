import { getJson, sendJson } from '../../../shared/api/client';
import type { components } from '../../../shared/api/schema';

export type PermissionMatrix = components['schemas']['PermissionMatrixDto'];
export type Role = components['schemas']['RoleDto'];
export type CreateRoleRequest = components['schemas']['CreateRoleDto'];
export type UpdateRoleRequest = components['schemas']['UpdateRoleDto'];
export type MatrixCell = components['schemas']['MatrixCellDto'];
export type SetRolePermissionRequest =
  components['schemas']['SetRolePermissionDto'];

const MATRIX_PATH = '/permissions/matrix';
const ROLES_PATH = '/roles';
const rolePath = (roleCode: string) =>
  `${ROLES_PATH}/${encodeURIComponent(roleCode)}`;
const cellPath = (roleCode: string, permissionCode: string) =>
  `${rolePath(roleCode)}/permissions/${encodeURIComponent(permissionCode)}`;

export const fetchPermissionMatrix = () =>
  getJson<PermissionMatrix>(MATRIX_PATH);
export const createRole = (body: CreateRoleRequest) =>
  sendJson<Role>('POST', ROLES_PATH, body);
export const updateRole = (roleCode: string, body: UpdateRoleRequest) =>
  sendJson<Role>('PATCH', rolePath(roleCode), body);
export const deleteRole = (roleCode: string) =>
  sendJson<void>('DELETE', rolePath(roleCode));
export const setMatrixCell = (
  roleCode: string,
  permissionCode: string,
  body: SetRolePermissionRequest,
) => sendJson<MatrixCell>('PUT', cellPath(roleCode, permissionCode), body);
export const clearMatrixCell = (roleCode: string, permissionCode: string) =>
  sendJson<void>('DELETE', cellPath(roleCode, permissionCode));
