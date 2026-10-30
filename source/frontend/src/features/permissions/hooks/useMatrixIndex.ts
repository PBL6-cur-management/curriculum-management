import { useMemo } from 'react';
import type { MatrixCell, PermissionMatrix } from '../api/permissionMatrix';

export interface MatrixIndex {
  cell: (roleCode: string, permissionCode: string) => MatrixCell | undefined;
  locked: (roleCode: string, permissionCode: string) => boolean;
}

const keyOf = (roleCode: string, permissionCode: string) =>
  `${roleCode}|${permissionCode}`;

// Lookup O(1) cho mỗi ô, dựng một lần mỗi khi dữ liệu ma trận đổi.
export function useMatrixIndex(data: PermissionMatrix | undefined): MatrixIndex {
  return useMemo(() => {
    const cells = new Map<string, MatrixCell>();
    const locked = new Set<string>();
    for (const cell of data?.cells ?? [])
      cells.set(keyOf(cell.roleCode, cell.permissionCode), cell);
    for (const cell of data?.lockedCells ?? [])
      locked.add(keyOf(cell.roleCode, cell.permissionCode));
    return {
      cell: (roleCode, permissionCode) =>
        cells.get(keyOf(roleCode, permissionCode)),
      locked: (roleCode, permissionCode) =>
        locked.has(keyOf(roleCode, permissionCode)),
    };
  }, [data]);
}
