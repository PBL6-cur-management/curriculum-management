import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import {
  ImportBatchStatus,
  ImportType,
} from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  IMPORT_LIMITS,
  type ImportJobData,
  type ImportJobName,
} from './import.constants.js';
import type { BatchDetailRow } from './import-mapping.js';
import { ImportsReader } from './imports.reader.js';
import { ImportsService } from './imports.service.js';
import type { StudentCredentialsService } from './student-credentials.service.js';
import { COURSE_CATALOG_SHEET } from './sheets/course-catalog.sheet.js';
import { writeSheet, writeTemplate } from './sheets/sheet-writer.js';

function access(
  code: PermissionCode = PERMISSIONS.DATA_IMPORT_EXCEL,
  all = true,
  userId = 'user',
) {
  return new AccessContext(userId, [
    {
      assignmentId: null,
      roleId: 'r',
      roleCode: 'R1',
      roleName: 'R1',
      scopeSource: 'NONE',
      scopeType: 'SYSTEM',
      scopeUnit: null,
      scope: {
        all: false,
        programIds: new Set(['program']),
        orgUnitIds: new Set(),
        subjectGroupIds: new Set(),
        studentIds: new Set(),
      },
      permissions: new Map([
        [code, { mode: 'DIRECT', scope: all ? 'ALL' : 'SCOPED' }],
      ]),
    },
  ]);
}
function batch(): BatchDetailRow {
  return {
    id: 'batch',
    importType: ImportType.COURSE_CATALOG,
    fileName: 'file.xlsx',
    performedById: 'user',
    performedBy: { id: 'user', fullName: 'User' },
    versionId: null,
    version: null,
    program: null,
    status: ImportBatchStatus.DRY_RUN,
    totalRows: 1,
    successRows: 1,
    errorRows: 0,
    errorReport: { formatErrors: [], issues: [] },
    recordedAt: new Date(),
    finishedAt: null,
    file: { expiresAt: new Date(Date.now() + 86_400_000) },
  };
}
describe('ImportsService', () => {
  let service: ImportsService;
  let create: ReturnType<typeof vi.fn>;
  let updateMany: ReturnType<typeof vi.fn>;
  let findUnique: ReturnType<typeof vi.fn>;
  let findFirst: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  let add: ReturnType<typeof vi.fn>;
  let visible: ReturnType<typeof vi.fn>;
  let assertConfigured: ReturnType<typeof vi.fn>;
  let detail: ReturnType<typeof vi.fn>;
  let file: Express.Multer.File;
  beforeEach(async () => {
    create = vi
      .fn()
      .mockResolvedValue({ ...batch(), status: ImportBatchStatus.VALIDATING });
    updateMany = vi.fn().mockResolvedValue({ count: 1 });
    findUnique = vi.fn().mockResolvedValue({
      id: 'version',
      programId: 'program',
      status: 'DRAFT',
      sourceRequestId: null,
      correctionOfId: null,
      program: { id: 'program', facultyId: 'faculty' },
    });
    findFirst = vi.fn().mockResolvedValue(null);
    findMany = vi.fn().mockResolvedValue([]);
    add = vi.fn().mockResolvedValue({});
    assertConfigured = vi.fn();
    visible = vi.fn().mockResolvedValue(batch());
    detail = vi
      .fn()
      .mockResolvedValue({ ...batch(), status: ImportBatchStatus.COMMITTING });
    const prisma = {
      importBatch: { create, updateMany },
      programVersion: { findUnique, findFirst, findMany },
    } as unknown as PrismaService;
    service = new ImportsService(
      prisma,
      { add } as unknown as Queue<ImportJobData, void, ImportJobName>,
      {
        visible,
        detail,
        list: vi.fn(),
        file: vi.fn(),
      } as unknown as ImportsReader,
      { assertConfigured } as unknown as StudentCredentialsService,
    );
    const buffer = Buffer.from(
      await writeSheet(COURSE_CATALOG_SHEET, {}, [{ courseCode: 'A' }]),
    );
    file = {
      originalname: 'file.xlsx',
      buffer,
      size: buffer.length,
    } as Express.Multer.File;
  });
  it('requires a file and rejects old Excel extensions and oversized buffers', async () => {
    await expect(
      service.create(
        undefined,
        { importType: ImportType.COURSE_CATALOG },
        access(),
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_FILE_REQUIRED' });
    await expect(
      service.create(
        { ...file, originalname: 'file.xls' },
        { importType: ImportType.COURSE_CATALOG },
        access(),
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_FILE_NOT_XLSX' });
    await expect(
      service.create(
        { ...file, buffer: Buffer.alloc(IMPORT_LIMITS.FILE_MAX_BYTES + 1) },
        { importType: ImportType.COURSE_CATALOG },
        access(),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it('requires a version only for curriculum and rejects wave-2 types', async () => {
    await expect(
      service.create(file, { importType: ImportType.CURRICULUM }, access()),
    ).rejects.toMatchObject({ code: 'IMPORT_VERSION_REQUIRED' });
    await expect(
      service.create(
        file,
        { importType: ImportType.COURSE_CATALOG, versionId: 'version' },
        access(),
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_VERSION_NOT_ALLOWED' });
  });
  it('refuses student imports to a non-R1 importer and checks the credential key first', async () => {
    await expect(
      service.create(
        file,
        { importType: ImportType.STUDENT_LIST },
        access(PERMISSIONS.DATA_IMPORT_EXCEL, false),
      ),
    ).rejects.toBeDefined();
    assertConfigured.mockImplementation(() => {
      throw new Error('KEY_MISSING');
    });
    await expect(
      service.create(file, { importType: ImportType.STUDENT_LIST }, access()),
    ).rejects.toThrow('KEY_MISSING');
    expect(assertConfigured).toHaveBeenCalled();
  });
  it('refuses a scoped catalog importer and an ever-released program', async () => {
    await expect(
      service.create(
        file,
        { importType: ImportType.COURSE_CATALOG },
        access(PERMISSIONS.DATA_IMPORT_EXCEL, false),
      ),
    ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    findFirst.mockResolvedValue({ id: 'published' });
    await expect(
      service.create(
        file,
        { importType: ImportType.CURRICULUM, versionId: 'version' },
        access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL),
      ),
    ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    expect(create).not.toHaveBeenCalled();
  });
  it('refuses out-of-scope curriculum uploads before storing a batch or queueing work', async () => {
    findUnique.mockResolvedValue({
      id: 'outside-version',
      programId: 'outside-program',
      status: 'DRAFT',
      sourceRequestId: null,
      correctionOfId: null,
      program: { id: 'outside-program', facultyId: 'faculty' },
    });
    await expect(
      service.create(
        file,
        { importType: ImportType.CURRICULUM, versionId: 'outside-version' },
        access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, false),
      ),
    ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    expect(create).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
  it('records file and batch atomically before adding exactly one deduplicated validation job', async () => {
    const result = await service.create(
      file,
      { importType: ImportType.COURSE_CATALOG },
      access(),
    );
    expect(result.status).toBe(ImportBatchStatus.VALIDATING);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ImportBatchStatus.VALIDATING,
          file: {
            create: expect.objectContaining({
              sizeBytes: file.buffer.length,
              content: expect.any(Uint8Array),
            }),
          },
        }),
      }),
    );
    expect(add).toHaveBeenCalledExactlyOnceWith(
      'validate',
      { batchId: 'batch' },
      expect.objectContaining({ jobId: 'validate-batch' }),
    );
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      add.mock.invocationCallOrder[0],
    );
  });
  it('returns an immediately aborted format failure without queueing work', async () => {
    create.mockResolvedValue({ ...batch(), status: ImportBatchStatus.ABORTED });
    await service.create(
      { ...file, buffer: Buffer.from('invalid workbook') },
      { importType: ImportType.COURSE_CATALOG },
      access(),
    );
    expect(create.mock.calls[0][0].data).toMatchObject({
      status: ImportBatchStatus.ABORTED,
      errorReport: {
        formatErrors: [
          expect.objectContaining({ message: expect.any(String) }),
        ],
      },
    });
    expect(add).not.toHaveBeenCalled();
    await service.create(
      {
        ...file,
        buffer: Buffer.from(await writeTemplate(COURSE_CATALOG_SHEET)),
      },
      { importType: ImportType.COURSE_CATALOG },
      access(),
    );
    expect(
      create.mock.calls[1][0].data.errorReport.formatErrors[0].message,
    ).toBe('Tệp không có dòng dữ liệu.');
  });
  it('refuses a different committer, existing errors and a lost atomic status claim', async () => {
    await expect(
      service.commit(
        'batch',
        access(PERMISSIONS.DATA_IMPORT_EXCEL, true, 'other'),
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_NOT_OWNER' });
    visible.mockResolvedValue({ ...batch(), errorRows: 1 });
    await expect(service.commit('batch', access())).rejects.toMatchObject({
      code: 'IMPORT_HAS_ERRORS',
    });
    visible.mockResolvedValue(batch());
    updateMany.mockResolvedValue({ count: 0 });
    await expect(service.commit('batch', access())).rejects.toMatchObject({
      code: 'IMPORT_NOT_COMMITTABLE',
    });
    expect(add).not.toHaveBeenCalled();
  });
  it('claims DRY_RUN once, refreshes the stale-work clock, then queues commit', async () => {
    await service.commit('batch', access());
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ImportBatchStatus.DRY_RUN }),
        data: {
          status: ImportBatchStatus.COMMITTING,
          finishedAt: expect.any(Date),
        },
      }),
    );
    expect(add).toHaveBeenCalledExactlyOnceWith(
      'commit',
      { batchId: 'batch' },
      expect.objectContaining({ jobId: 'commit-batch' }),
    );
  });
  it('refuses missing or expired retained files before commit', async () => {
    visible.mockResolvedValue({ ...batch(), file: null });
    await expect(service.commit('batch', access())).rejects.toMatchObject({
      code: 'IMPORT_FILE_EXPIRED',
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('filters targets by the actual R3 scope and excludes releases and working copies', async () => {
    findMany.mockResolvedValue([
      {
        id: 'v',
        programId: 'program',
        programName: 'Name',
        program: { programCode: 'P01' },
      },
    ]);
    expect(
      await service.curriculumTargets(
        access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, false),
      ),
    ).toEqual([
      {
        versionId: 'v',
        programId: 'program',
        programName: 'Name',
        programCode: 'P01',
      },
    ]);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      status: 'DRAFT',
      sourceRequestId: null,
      correctionOfId: null,
      program: {
        AND: [
          { OR: [{ id: { in: ['program'] } }, { facultyId: { in: [] } }] },
          { versions: { none: { status: { not: 'DRAFT' } } } },
        ],
      },
    });
  });
  it('returns only usable types and checks permissions per template type', async () => {
    expect(service.types(access(PERMISSIONS.DATA_IMPORT_EXCEL, false))).toEqual(
      [],
    );
    expect(service.types(access())).toEqual([
      { importType: ImportType.COURSE_CATALOG, needsVersion: false },
      { importType: ImportType.STUDENT_LIST, needsVersion: false },
      { importType: ImportType.ACADEMIC_RESULT, needsVersion: false },
    ]);
    expect(
      service.types(access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, false)),
    ).toEqual([{ importType: ImportType.CURRICULUM, needsVersion: true }]);
    await expect(
      service.template(
        ImportType.COURSE_CATALOG,
        access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, false),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(
      (
        await service.template(
          ImportType.CURRICULUM,
          access(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL, false),
        )
      ).content.byteLength,
    ).toBeGreaterThan(0);
  });
});
