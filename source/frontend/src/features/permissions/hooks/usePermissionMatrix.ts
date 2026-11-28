import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meQueryKey } from '../../../shared/auth/me';
import {
  clearMatrixCell,
  createRole,
  deleteRole,
  fetchPermissionMatrix,
  setMatrixCell,
  updateRole,
} from '../api/permissionMatrix';
import type {
  CreateRoleRequest,
  MatrixCell,
  SetRolePermissionRequest,
  UpdateRoleRequest,
} from '../api/permissionMatrix';

export const PERMISSION_MATRIX_QUERY_KEY = ['permission-matrix'] as const;
export const ROLES_QUERY_KEY = ['roles'] as const;

export function usePermissionMatrix() {
  return useQuery({
    queryKey: PERMISSION_MATRIX_QUERY_KEY,
    queryFn: fetchPermissionMatrix,
  });
}

export function useCreateRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoleRequest) => createRole(body),
    retry: false,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: PERMISSION_MATRIX_QUERY_KEY }),
        client.invalidateQueries({ queryKey: ROLES_QUERY_KEY }),
      ]),
  });
}

export function useUpdateRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleCode,
      body,
    }: {
      roleCode: string;
      body: UpdateRoleRequest;
    }) => updateRole(roleCode, body),
    retry: false,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: PERMISSION_MATRIX_QUERY_KEY }),
        client.invalidateQueries({ queryKey: ROLES_QUERY_KEY }),
        client.invalidateQueries({ queryKey: meQueryKey }),
      ]),
  });
}

export function useDeleteRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (roleCode: string) => deleteRole(roleCode),
    retry: false,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: PERMISSION_MATRIX_QUERY_KEY }),
        client.invalidateQueries({ queryKey: ROLES_QUERY_KEY }),
        client.invalidateQueries({ queryKey: meQueryKey }),
      ]),
  });
}

export function useMatrixMutations() {
  const client = useQueryClient();
  async function update(
    roleCode: string,
    permissionCode: string,
    cell: MatrixCell | undefined,
  ) {
    client.setQueryData<{
      roles: never[];
      permissions: never[];
      cells: MatrixCell[];
      lockedCells: { roleCode: string; permissionCode: string }[];
    }>(
      PERMISSION_MATRIX_QUERY_KEY,
      (current) =>
        current && {
          ...current,
          cells: [
            ...current.cells.filter(
              (entry) =>
                !(
                  entry.roleCode === roleCode &&
                  entry.permissionCode === permissionCode
                ),
            ),
            ...(cell ? [cell] : []),
          ],
        },
    );
    await Promise.all([
      client.invalidateQueries({ queryKey: PERMISSION_MATRIX_QUERY_KEY }),
      client.invalidateQueries({ queryKey: meQueryKey }),
    ]);
  }
  const set = useMutation({
    mutationFn: ({
      roleCode,
      permissionCode,
      body,
    }: {
      roleCode: string;
      permissionCode: string;
      body: SetRolePermissionRequest;
    }) => setMatrixCell(roleCode, permissionCode, body),
    onSuccess: (cell) => update(cell.roleCode, cell.permissionCode, cell),
  });
  const clear = useMutation({
    mutationFn: ({
      roleCode,
      permissionCode,
    }: {
      roleCode: string;
      permissionCode: string;
    }) => clearMatrixCell(roleCode, permissionCode),
    onSuccess: (_, variables) =>
      update(variables.roleCode, variables.permissionCode, undefined),
  });
  return { set, clear };
}
