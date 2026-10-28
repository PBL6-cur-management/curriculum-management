import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import { AccessContext, type ActiveAssignment } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import {
  encryptStudentCredentials,
  STUDENT_CREDENTIALS,
} from '../../shared/students/student-credential-cipher.js';
import { StudentCredentialsService } from './student-credentials.service.js';

const KEY = Buffer.alloc(32, 9);
const NOW = new Date('2026-10-28T00:00:00.000Z');

const office = {
  roleCode: 'R1',
  permissions: new Map([[PERMISSIONS.DATA_IMPORT_EXCEL, { mode: 'DIRECT', scope: 'ALL' }]]),
} as unknown as ActiveAssignment;
const access = new AccessContext('actor', [office]);
const outsider = new AccessContext('actor', []);

const account = {
  studentCode: 'SYN-STU-0001',
  username: 'syn-stu-0001',
  passwordHash: 'hash',
  temporaryPassword: 'Secret-Pass-1',
};

function setup(options: { key?: string | undefined; delivery?: Record<string, unknown> | null; batch?: unknown } = {}) {
  const hasKey = 'key' in options ? options.key : KEY.toString('base64');
  let delivery: Record<string, unknown> | null =
    options.delivery === undefined ? null : options.delivery;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    importBatch: {
      findFirst: vi.fn().mockResolvedValue('batch' in options ? options.batch : { id: 'b1' }),
    },
    studentCredentialDelivery: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        delivery = data;
        return data;
      }),
      findUnique: vi.fn(async () => delivery),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        delivery = { ...delivery, ...data };
        return delivery;
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
  const prisma = { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  const config = { get: vi.fn().mockReturnValue(hasKey) } as unknown as ConfigService<never, true>;
  return { tx, service: new StudentCredentialsService(prisma as never, config as never) };
}

const sealed = (owner = 'actor', key: Uint8Array = KEY) => {
  const value = encryptStudentCredentials(new Uint8Array([1, 2, 3]), key, 'b1', owner);
  return {
    batchId: 'b1',
    accountCount: 1,
    ciphertext: Buffer.from(value.ciphertext),
    iv: Buffer.from(value.iv),
    authTag: Buffer.from(value.authTag),
    keyId: value.keyId,
    expiresAt: new Date(NOW.getTime() + 1000),
    downloadedAt: null,
  };
};

describe('StudentCredentialsService', () => {
  it('answers 503 without a configured key, before and during storage', async () => {
    const { service, tx } = setup({ key: undefined });
    expect(() => service.assertConfigured()).toThrow(
      expect.objectContaining({ code: 'STUDENT_CREDENTIALS_UNAVAILABLE', status: 503 }),
    );
    await expect(service.store(tx as never, 'b1', 'actor', [account])).rejects.toMatchObject({
      code: 'STUDENT_CREDENTIALS_UNAVAILABLE',
    });
  });

  it('stores an encrypted workbook with a 24 hour expiry and no plaintext', async () => {
    const { service, tx } = setup();
    await service.store(tx as never, 'b1', 'actor', [account], NOW);
    const data = tx.studentCredentialDelivery.create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.accountCount).toBe(1);
    expect(data.expiresAt).toEqual(new Date(NOW.getTime() + STUDENT_CREDENTIALS.TTL_MS));
    expect(Buffer.from(data.ciphertext as Buffer).includes(Buffer.from(account.temporaryPassword))).toBe(false);
    expect(JSON.stringify(data)).not.toContain(account.temporaryPassword);
  });

  it('stores nothing when no account was created', async () => {
    const { service, tx } = setup();
    await service.store(tx as never, 'b1', 'actor', [], NOW);
    expect(tx.studentCredentialDelivery.create).not.toHaveBeenCalled();
  });

  it('delivers the workbook once with the password, then answers 410', async () => {
    const { service, tx } = setup();
    await service.store(tx as never, 'b1', 'actor', [account], NOW);
    const first = await service.consume('b1', access, NOW);
    expect(first.fileName).toBe('mat-khau-ban-dau-b1.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(first.content).buffer);
    const rows = workbook.worksheets[0]!.getSheetValues();
    expect(JSON.stringify(rows)).toContain(account.temporaryPassword);
    expect(tx.studentCredentialDelivery.update).toHaveBeenCalledWith({
      where: { batchId: 'b1' },
      data: expect.objectContaining({ ciphertext: null, iv: null, authTag: null, keyId: null }),
    });
    await expect(service.consume('b1', access, NOW)).rejects.toMatchObject({
      code: 'CREDENTIALS_ALREADY_DOWNLOADED',
      status: 410,
    });
  });

  it('answers 410 when expired or purged', async () => {
    const expired = setup({ delivery: { ...sealed(), expiresAt: new Date(NOW.getTime() - 1) } });
    await expect(expired.service.consume('b1', access, NOW)).rejects.toMatchObject({ code: 'CREDENTIALS_EXPIRED' });
    const purged = setup({ delivery: { ...sealed(), ciphertext: null } });
    await expect(purged.service.consume('b1', access, NOW)).rejects.toMatchObject({ code: 'CREDENTIALS_EXPIRED' });
  });

  it('keeps the payload when it cannot be decrypted', async () => {
    const wrongOwner = setup({ delivery: sealed('someone-else') });
    await expect(wrongOwner.service.consume('b1', access, NOW)).rejects.toMatchObject({
      code: 'CREDENTIALS_UNREADABLE',
    });
    expect(wrongOwner.tx.studentCredentialDelivery.update).not.toHaveBeenCalled();
    const rotated = setup({ delivery: sealed('actor', new Uint8Array(Buffer.alloc(32, 1))) });
    await expect(rotated.service.consume('b1', access, NOW)).rejects.toMatchObject({
      code: 'CREDENTIALS_UNREADABLE',
    });
  });

  it('rechecks the import gate and batch ownership on every call', async () => {
    const denied = setup({ delivery: sealed() });
    await expect(denied.service.consume('b1', outsider, NOW)).rejects.toBeDefined();
    const notOwner = setup({ delivery: sealed(), batch: null });
    await expect(notOwner.service.consume('b1', access, NOW)).rejects.toMatchObject({
      code: 'IMPORT_BATCH_NOT_FOUND',
    });
    expect(notOwner.tx.importBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ performedById: 'actor', status: 'COMMITTED', importType: 'STUDENT_LIST' }),
      }),
    );
  });

  it('reports availability without exposing the payload and purges expired ones', async () => {
    const { service, tx } = setup({ delivery: sealed() });
    expect(await service.status('b1', access, NOW)).toEqual({
      available: true,
      accountCount: 1,
      expiresAt: new Date(NOW.getTime() + 1000).toISOString(),
      downloadedAt: null,
    });
    expect(await service.purgeExpired(NOW)).toBe(2);
    expect(tx.studentCredentialDelivery.updateMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: NOW }, ciphertext: { not: null } },
      data: { ciphertext: null, iv: null, authTag: null, keyId: null },
    });
  });
});
