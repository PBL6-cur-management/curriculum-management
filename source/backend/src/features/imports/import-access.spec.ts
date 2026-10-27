import { describe, expect, it, vi } from 'vitest';
import {
  ImportType,
  ProgramVersionStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import {
  assertCatalogImport,
  assertCurriculumImport,
  assertSupported,
  visibleBatches,
  type ImportVersionRow,
} from './import-access.js';

function access(code: PermissionCode, all: boolean) {
  return new AccessContext('user', [
    {
      assignmentId: null,
      roleId: 'role',
      roleCode: 'R3',
      roleName: 'R3',
      scopeSource: 'NONE',
      scopeType: 'SYSTEM',
      scopeUnit: null,
      scope: {
        all: false,
        orgUnitIds: new Set(['faculty']),
        programIds: new Set(['program']),
        subjectGroupIds: new Set(),
        studentIds: new Set(),
      },
      permissions: new Map([
        [code, { mode: 'DIRECT', scope: all ? 'ALL' : 'SCOPED' }],
      ]),
    },
  ]);
}
const VERSION: ImportVersionRow = {
  id: 'version',
  programId: 'program',
  status: ProgramVersionStatus.DRAFT,
  sourceRequestId: null,
  correctionOfId: null,
  program: { id: 'program', facultyId: 'faculty' },
};
describe('import access', () => {
  it('allows catalog only with ALL scope', () => {
    expect(() =>
      assertCatalogImport(access(PERMISSIONS.DATA_IMPORT_EXCEL, true)),
    ).not.toThrow();
    expect(() =>
      assertCatalogImport(access(PERMISSIONS.DATA_IMPORT_EXCEL, false)),
    ).toThrow(expect.objectContaining({ code: 'OUT_OF_SCOPE' }));
    expect(() => assertCatalogImport(new AccessContext('u', []))).toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }),
    );
  });
  it.each([ImportType.STUDENT_LIST, ImportType.ACADEMIC_RESULT])(
    'refuses unavailable %s',
    (type) => {
      expect(() => assertSupported(type)).toThrow(
        expect.objectContaining({ code: 'IMPORT_TYPE_UNAVAILABLE' }),
      );
    },
  );
  it.each([
    ProgramVersionStatus.PENDING,
    ProgramVersionStatus.ACTIVE,
    ProgramVersionStatus.HISTORICAL,
  ])('refuses non-Draft %s', async (status) => {
    await expect(
      assertCurriculumImport(
        {} as Prisma.TransactionClient,
        access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, true),
        { ...VERSION, status },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_VERSION_NOT_DRAFT' });
  });
  it('allows a scoped ordinary Draft and refuses every ever-released program', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const client = {
      programVersion: { findFirst },
    } as unknown as Prisma.TransactionClient;
    await expect(
      assertCurriculumImport(
        client,
        access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, false),
        VERSION,
      ),
    ).resolves.toBeUndefined();
    expect(findFirst.mock.calls[0][0].where.status).toEqual({
      not: ProgramVersionStatus.DRAFT,
    });
    findFirst.mockResolvedValue({ id: 'released' });
    await expect(
      assertCurriculumImport(
        client,
        access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, false),
        VERSION,
      ),
    ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
  });
  it.each([{ sourceRequestId: 'request' }, { correctionOfId: 'base' }])(
    'does not open a working-copy import path',
    async (changes) => {
      const client = {
        programVersion: { findFirst: vi.fn().mockResolvedValue(null) },
      } as unknown as Prisma.TransactionClient;
      await expect(
        assertCurriculumImport(
          client,
          access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, true),
          { ...VERSION, ...changes },
        ),
      ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    },
  );
  it('includes own history and only scoped curriculum history for R3', () => {
    const where = visibleBatches(
      access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, false),
    );
    expect(where.OR).toEqual([
      { performedById: 'user' },
      {
        importType: ImportType.CURRICULUM,
        program: {
          OR: [{ id: { in: ['program'] } }, { facultyId: { in: ['faculty'] } }],
        },
      },
    ]);
    expect(visibleBatches(new AccessContext('u', []))).toEqual({
      OR: [{ performedById: 'u' }],
    });
  });
});
