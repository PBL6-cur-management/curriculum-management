import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PermissionMode,
  PermissionScope,
  Prisma,
  ScopeSource,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { PermissionsService } from './permissions.service.js';

describe('PermissionsService', () => {
  let roleFindMany: ReturnType<typeof vi.fn>;
  let roleFindUnique: ReturnType<typeof vi.fn>;
  let roleCreate: ReturnType<typeof vi.fn>;
  let roleUpdate: ReturnType<typeof vi.fn>;
  let roleDelete: ReturnType<typeof vi.fn>;
  let permissionFindMany: ReturnType<typeof vi.fn>;
  let permissionFindUnique: ReturnType<typeof vi.fn>;
  let cellFindMany: ReturnType<typeof vi.fn>;
  let cellFindUnique: ReturnType<typeof vi.fn>;
  let cellUpsert: ReturnType<typeof vi.fn>;
  let cellDeleteMany: ReturnType<typeof vi.fn>;
  let assignmentCount: ReturnType<typeof vi.fn>;
  let approvalLevelCount: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;
  let service: PermissionsService;

  beforeEach(() => {
    roleFindMany = vi.fn().mockResolvedValue([]);
    roleFindUnique = vi.fn().mockResolvedValue({
      id: 'role-2',
      roleCode: 'R2',
      roleName: 'Ban lãnh đạo khoa',
      description: null,
      isSystemRole: true,
      scopeSource: ScopeSource.NONE,
    });
    roleCreate = vi.fn();
    roleUpdate = vi.fn();
    roleDelete = vi.fn();
    permissionFindMany = vi.fn().mockResolvedValue([]);
    permissionFindUnique = vi.fn().mockResolvedValue({ id: 'permission-1' });
    cellFindMany = vi.fn().mockResolvedValue([]);
    cellFindUnique = vi.fn().mockResolvedValue(null);
    cellUpsert = vi.fn();
    cellDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    assignmentCount = vi.fn().mockResolvedValue(0);
    approvalLevelCount = vi.fn().mockResolvedValue(0);
    const client = {
      role: {
        findMany: roleFindMany,
        findUnique: roleFindUnique,
        create: roleCreate,
        update: roleUpdate,
        delete: roleDelete,
      },
      permission: {
        findMany: permissionFindMany,
        findUnique: permissionFindUnique,
      },
      rolePermission: {
        findMany: cellFindMany,
        findUnique: cellFindUnique,
        upsert: cellUpsert,
        deleteMany: cellDeleteMany,
      },
      roleAssignment: { count: assignmentCount },
      approvalLevelConfig: { count: approvalLevelCount },
    };
    transaction = vi.fn(async (run: (tx: typeof client) => Promise<unknown>) =>
      run(client),
    );
    const prisma = {
      ...client,
      $transaction: transaction,
    } as unknown as PrismaService;
    service = new PermissionsService(prisma);
  });

  it('orders matrix permissions by the canonical catalog order', async () => {
    permissionFindMany.mockResolvedValue([
      {
        id: 'p2',
        permissionCode: PERMISSIONS.USER_MANAGE,
        permissionName: 'users',
        functionGroup: 'SYSTEM_ADMIN',
        description: null,
        source: null,
      },
      {
        id: 'p1',
        permissionCode: PERMISSIONS.ORG_UNIT_MANAGE,
        permissionName: 'units',
        functionGroup: 'SYSTEM_ADMIN',
        description: null,
        source: null,
      },
    ]);

    const result = await service.matrix();

    expect(
      result.permissions.map((permission) => permission.permissionCode),
    ).toEqual([PERMISSIONS.ORG_UNIT_MANAGE, PERMISSIONS.USER_MANAGE]);
  });

  it('refuses changing a locked cell away from DIRECT/ALL', async () => {
    roleFindUnique.mockResolvedValue({ id: 'role-1', roleCode: 'R1' });
    permissionFindUnique.mockResolvedValue({ id: 'p1' });

    await expect(
      service.setCell(
        'R1',
        PERMISSIONS.USER_MANAGE,
        { mode: PermissionMode.VIA_REQUEST, scope: PermissionScope.ALL },
        'actor',
      ),
    ).rejects.toMatchObject({ code: 'MATRIX_CELL_LOCKED' });
    expect(cellUpsert).not.toHaveBeenCalled();
  });

  it('refuses clearing locked cells', async () => {
    await expect(
      service.clearCell('R1', PERMISSIONS.PERMISSION_MANAGE, 'actor'),
    ).rejects.toMatchObject({ code: 'MATRIX_CELL_LOCKED' });
    expect(roleFindUnique).not.toHaveBeenCalled();
    expect(cellDeleteMany).not.toHaveBeenCalled();
  });

  it('returns 404 errors for unknown role and permission', async () => {
    roleFindUnique.mockResolvedValue(null);
    await expect(
      service.setCell(
        'MISSING',
        PERMISSIONS.USER_MANAGE,
        {
          mode: PermissionMode.DIRECT,
          scope: PermissionScope.ALL,
        },
        'actor',
      ),
    ).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
    roleFindUnique.mockResolvedValue({ id: 'role-2', roleCode: 'R2' });
    permissionFindUnique.mockResolvedValue(null);
    await expect(
      service.setCell(
        'R2',
        'unknown.permission',
        {
          mode: PermissionMode.DIRECT,
          scope: PermissionScope.ALL,
        },
        'actor',
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_NOT_FOUND' });
  });

  it('clears a missing matrix cell without writing', async () => {
    await expect(
      service.clearCell('R2', PERMISSIONS.COURSE_VIEW, 'actor'),
    ).resolves.toBeUndefined();
    expect(cellDeleteMany).toHaveBeenCalled();
  });

  describe('Dynamic Roles CRUD', () => {
    const customRole = {
      id: 'role-custom',
      roleCode: 'QA_REVIEWER',
      roleName: 'Chuyên viên Kiểm định',
      description: 'Phụ trách kiểm định chất lượng',
      isSystemRole: false,
      scopeSource: ScopeSource.NONE,
    };

    it('creates a custom assignable role with ScopeSource.NONE and isSystemRole=false', async () => {
      roleCreate.mockResolvedValueOnce(customRole);
      const created = await service.createRole(
        {
          roleCode: 'qa_reviewer',
          roleName: 'Chuyên viên Kiểm định',
          description: 'Phụ trách kiểm định chất lượng',
        },
        'actor',
      );
      expect(created).toEqual({
        ...customRole,
        assignable: true,
      });
      expect(roleCreate).toHaveBeenCalledWith({
        data: {
          roleCode: 'QA_REVIEWER',
          roleName: 'Chuyên viên Kiểm định',
          description: 'Phụ trách kiểm định chất lượng',
          isSystemRole: false,
          scopeSource: ScopeSource.NONE,
        },
      });
    });

    it('rejects duplicate roleCode and reserved INTEGRATION role code with 409 ROLE_CODE_TAKEN', async () => {
      roleCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.createRole(
          { roleCode: 'QA_REVIEWER', roleName: 'Duplicate' },
          'actor',
        ),
      ).rejects.toMatchObject({ code: 'ROLE_CODE_TAKEN' });

      await expect(
        service.createRole(
          { roleCode: 'INTEGRATION', roleName: 'Reserved' },
          'actor',
        ),
      ).rejects.toMatchObject({ code: 'ROLE_CODE_TAKEN' });
    });

    it('updates roleName and description while keeping roleCode immutable', async () => {
      roleFindUnique.mockResolvedValueOnce(customRole);
      roleUpdate.mockResolvedValueOnce({
        ...customRole,
        roleName: 'Tổ Đảm bảo chất lượng',
        description: null,
      });
      const updated = await service.updateRole(
        'QA_REVIEWER',
        { roleName: 'Tổ Đảm bảo chất lượng', description: null },
        'actor',
      );
      expect(updated.roleName).toBe('Tổ Đảm bảo chất lượng');
      expect(updated.description).toBeNull();
      expect(roleUpdate).toHaveBeenCalledWith({
        where: { id: customRole.id },
        data: { roleName: 'Tổ Đảm bảo chất lượng', description: null },
      });

      roleFindUnique.mockResolvedValueOnce(null);
      await expect(
        service.updateRole('UNKNOWN', { roleName: 'Nope' }, 'actor'),
      ).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
    });

    it('protects system roles from deletion with 409 SYSTEM_ROLE_LOCKED', async () => {
      roleFindUnique.mockResolvedValueOnce({
        ...customRole,
        id: 'role-r1',
        roleCode: 'R1',
        isSystemRole: true,
      });
      await expect(service.deleteRole('R1', 'actor')).rejects.toMatchObject({
        code: 'SYSTEM_ROLE_LOCKED',
      });
      expect(roleDelete).not.toHaveBeenCalled();
    });

    it('protects roles in use (active RoleAssignment or ApprovalLevelConfig) with 409 ROLE_IN_USE', async () => {
      roleFindUnique.mockResolvedValue(customRole);
      assignmentCount.mockResolvedValueOnce(1);
      await expect(
        service.deleteRole('QA_REVIEWER', 'actor'),
      ).rejects.toMatchObject({ code: 'ROLE_IN_USE' });

      assignmentCount.mockResolvedValueOnce(0);
      approvalLevelCount.mockResolvedValueOnce(1);
      await expect(
        service.deleteRole('QA_REVIEWER', 'actor'),
      ).rejects.toMatchObject({ code: 'ROLE_IN_USE' });
      expect(roleDelete).not.toHaveBeenCalled();
    });

    it('deletes custom role and its RolePermission rows in a transaction', async () => {
      roleFindUnique.mockResolvedValueOnce(customRole);
      assignmentCount.mockResolvedValueOnce(0);
      approvalLevelCount.mockResolvedValueOnce(0);
      roleDelete.mockResolvedValueOnce(customRole);

      await expect(
        service.deleteRole('QA_REVIEWER', 'actor'),
      ).resolves.toBeUndefined();
      expect(transaction).toHaveBeenCalledOnce();
      expect(cellDeleteMany).toHaveBeenCalledWith({
        where: { roleId: customRole.id },
      });
      expect(roleDelete).toHaveBeenCalledWith({ where: { id: customRole.id } });
    });
  });
});
