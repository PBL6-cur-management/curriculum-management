import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import {
  ImportBatchStatus,
  ImportType,
  UserStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { AppliedProgramVersionReader } from '../../shared/releases/applied-program-version.reader.js';
import type {
  PreparedStudentAccount,
  StudentAccountProvisioner,
} from '../../shared/students/student-account.provisioner.js';
import { IMPORT_JOB, type ImportJobData } from './import.constants.js';
import { IMPORT_ABORT_MESSAGE } from './import-errors.js';
import { readImportSheet, validateImport } from './import-validation.js';
import { ImportsProcessor } from './imports.processor.js';
import type { StudentCredentialsService } from './student-credentials.service.js';
import { writeAcademicResults } from './writers/academic-result-writer.js';
import { writeStudents } from './writers/student-writer.js';

vi.mock('./import-validation.js', () => ({
  readImportSheet: vi.fn(),
  validateImport: vi.fn(),
}));
vi.mock('./writers/student-writer.js', () => ({ writeStudents: vi.fn() }));
vi.mock('./writers/academic-result-writer.js', () => ({
  writeAcademicResults: vi.fn(),
}));

const account = (studentCode: string): PreparedStudentAccount =>
  ({
    studentCode,
    username: studentCode.toLowerCase(),
    temporaryPassword: `pw-${studentCode}`,
    passwordHash: 'hash',
  }) as PreparedStudentAccount;

describe('ImportsProcessor student commit', () => {
  let processor: ImportsProcessor;
  let batchUpdate: ReturnType<typeof vi.fn>;
  let batchUpdateMany: ReturnType<typeof vi.fn>;
  let userFind: ReturnType<typeof vi.fn>;
  let assignmentFind: ReturnType<typeof vi.fn>;
  let store: ReturnType<typeof vi.fn>;
  let prepare: ReturnType<typeof vi.fn>;
  let batch: Record<string, unknown>;

  const committing = (importType: ImportType) => ({
    id: 'batch',
    status: ImportBatchStatus.COMMITTING,
    importType,
    versionId: null,
    totalRows: 3,
    performedById: 'importer',
    file: {
      content: new Uint8Array([1]),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    batch = committing(ImportType.STUDENT_LIST);
    batchUpdate = vi.fn().mockResolvedValue({});
    batchUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    userFind = vi.fn().mockResolvedValue({ status: UserStatus.ACTIVE });
    assignmentFind = vi.fn().mockResolvedValue({ id: 'assignment' });
    store = vi.fn().mockResolvedValue(undefined);
    prepare = vi.fn().mockResolvedValue([account('SV001'), account('SV002')]);
    const prisma = {
      importBatch: {
        findUnique: vi.fn(() => Promise.resolve(batch)),
        update: batchUpdate,
        updateMany: batchUpdateMany,
      },
      user: { findUnique: userFind },
      roleAssignment: { findFirst: assignmentFind },
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn((run: (tx: Prisma.TransactionClient) => unknown) =>
        run(prisma as unknown as Prisma.TransactionClient),
      ),
    } as unknown as PrismaService;
    processor = new ImportsProcessor(
      prisma,
      {} as CourseUsageReader,
      { upsertJobScheduler: vi.fn(), close: vi.fn() } as unknown as Queue<
        ImportJobData,
        void
      >,
      {} as AppliedProgramVersionReader,
      { store } as unknown as StudentCredentialsService,
      { prepare } as unknown as StudentAccountProvisioner,
    );
    vi.mocked(readImportSheet).mockResolvedValue({
      nonText: new Map(),
      importType: ImportType.STUDENT_LIST,
      sheet: { header: {}, rows: [], formatErrors: [], unknownColumns: [] },
    });
    vi.mocked(validateImport).mockResolvedValue({
      importType: ImportType.STUDENT_LIST,
      totalRows: 3,
      errorRows: 0,
      report: { formatErrors: [], issues: [] },
      plan: {
        rows: [
          { existingId: null, profile: { studentCode: 'SV001' } },
          { existingId: null, profile: { studentCode: 'SV002' } },
          { existingId: 'existing', profile: { studentCode: 'SV003' } },
        ],
      },
    } as never);
    vi.mocked(writeStudents).mockResolvedValue({
      createdAccountCodes: ['SV001'],
    } as never);
  });

  const commit = () =>
    processor.process({ name: IMPORT_JOB.COMMIT, data: { batchId: 'batch' } });

  it('aborts with ACCESS_REVOKED and writes nothing when the importer lost the grant', async () => {
    assignmentFind.mockResolvedValue(null);
    await commit();
    expect(writeStudents).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(batchUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ImportBatchStatus.ABORTED }),
      }),
    );
    const report = JSON.stringify(batchUpdateMany.mock.calls[0]![0]);
    expect(report).toContain(IMPORT_ABORT_MESSAGE.ACCESS_REVOKED.slice(0, 20));
  });

  it('aborts when the importer account is no longer active', async () => {
    userFind.mockResolvedValue({ status: UserStatus.DISABLED });
    await commit();
    expect(writeStudents).not.toHaveBeenCalled();
    expect(assignmentFind).not.toHaveBeenCalled();
  });

  it('stores credentials only for accounts the writer created', async () => {
    await commit();
    expect(store).toHaveBeenCalledTimes(1);
    const stored = store.mock.calls[0]![3] as PreparedStudentAccount[];
    expect(stored.map((item) => item.studentCode)).toEqual(['SV001']);
    expect(store.mock.calls[0]![1]).toBe('batch');
    expect(store.mock.calls[0]![2]).toBe('importer');
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ImportBatchStatus.COMMITTED }),
      }),
    );
  });

  it('prepares accounts only for rows that have no profile yet', async () => {
    await commit();
    expect(prepare).toHaveBeenCalledWith(['SV001', 'SV002']);
  });

  it('does not touch the credential store for a result import', async () => {
    batch = committing(ImportType.ACADEMIC_RESULT);
    vi.mocked(validateImport).mockResolvedValue({
      importType: ImportType.ACADEMIC_RESULT,
      totalRows: 3,
      errorRows: 0,
      report: { formatErrors: [], issues: [] },
      plan: { rows: [] },
    } as never);
    await commit();
    expect(prepare).not.toHaveBeenCalled();
    expect(writeAcademicResults).toHaveBeenCalledTimes(1);
    expect(store).not.toHaveBeenCalled();
  });

  it('lets a writer failure escape the transaction without marking the batch committed', async () => {
    vi.mocked(writeStudents).mockRejectedValue(new Error('write failed'));
    await expect(commit()).rejects.toThrow('write failed');
    expect(store).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it('lets a credential-store failure escape so the student writes roll back with it', async () => {
    store.mockRejectedValue(new Error('encrypt failed'));
    await expect(commit()).rejects.toThrow('encrypt failed');
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it('aborts with the dry-run report when the file changed to have errors', async () => {
    vi.mocked(validateImport).mockResolvedValue({
      importType: ImportType.STUDENT_LIST,
      totalRows: 3,
      errorRows: 1,
      report: { formatErrors: [], issues: [] },
      plan: { rows: [] },
    } as never);
    await commit();
    expect(writeStudents).not.toHaveBeenCalled();
    expect(batchUpdateMany).toHaveBeenCalledTimes(1);
  });
});
