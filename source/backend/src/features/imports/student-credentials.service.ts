import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import {
  ImportBatchStatus,
  ImportType,
  Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import type { Env } from '../../shared/config/env.validation.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { assertStudentImport } from '../../shared/students/student-access.js';
import type { PreparedStudentAccount } from '../../shared/students/student-account.provisioner.js';
import {
  credentialKeyFrom,
  decryptStudentCredentials,
  encryptStudentCredentials,
  STUDENT_CREDENTIALS,
} from '../../shared/students/student-credential-cipher.js';
import { STUDENT_ERRORS } from '../../shared/students/student.errors.js';
import { StudentCredentialStatusDto } from './dto/student-credential.dto.js';
import { IMPORT_ERRORS } from './import-errors.js';

export const CREDENTIAL_SHEET = {
  sheetName: 'Mật khẩu ban đầu',
  headers: ['Mã sinh viên', 'Tên đăng nhập', 'Mật khẩu ban đầu'],
  width: 24,
  fileNamePrefix: 'mat-khau-ban-dau-',
  mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

// Plaintext exists only while the workbook is built (at commit) and while one authorized download is served; storage holds ciphertext.
@Injectable()
export class StudentCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Throws the 503 before any work is done, so a file that needs accounts is refused instead of imported without them.
  assertConfigured(): void {
    this.key();
  }

  async store(
    tx: Prisma.TransactionClient,
    batchId: string,
    ownerId: string,
    accounts: readonly PreparedStudentAccount[],
    now: Date = new Date(),
  ): Promise<void> {
    if (accounts.length === 0) return;
    const sealed = encryptStudentCredentials(
      await this.buildWorkbook(accounts),
      this.key(),
      batchId,
      ownerId,
    );
    await tx.studentCredentialDelivery.create({
      data: {
        batchId,
        accountCount: accounts.length,
        ciphertext: Buffer.from(sealed.ciphertext),
        iv: Buffer.from(sealed.iv),
        authTag: Buffer.from(sealed.authTag),
        keyId: sealed.keyId,
        expiresAt: new Date(now.getTime() + STUDENT_CREDENTIALS.TTL_MS),
      },
    });
  }

  async status(
    batchId: string,
    access: AccessContext,
    now: Date = new Date(),
  ): Promise<StudentCredentialStatusDto> {
    await this.assertOwnBatch(this.prisma, batchId, access);
    const delivery = await this.prisma.studentCredentialDelivery.findUnique({
      where: { batchId },
    });
    if (!delivery) {
      return {
        available: false,
        accountCount: 0,
        expiresAt: null,
        downloadedAt: null,
      };
    }
    return {
      available:
        delivery.ciphertext !== null &&
        delivery.downloadedAt === null &&
        delivery.expiresAt.getTime() > now.getTime(),
      accountCount: delivery.accountCount,
      expiresAt: delivery.expiresAt.toISOString(),
      downloadedAt: delivery.downloadedAt?.toISOString() ?? null,
    };
  }

  consume(
    batchId: string,
    access: AccessContext,
    now: Date = new Date(),
  ): Promise<{ content: Uint8Array; fileName: string }> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnBatch(tx, batchId, access);
      await tx.$queryRaw`SELECT "batchId" FROM "StudentCredentialDelivery" WHERE "batchId" = ${batchId} FOR UPDATE`;
      const delivery = await tx.studentCredentialDelivery.findUnique({
        where: { batchId },
      });
      if (!delivery) throw new AppException(IMPORT_ERRORS.BATCH_NOT_FOUND);
      if (delivery.downloadedAt) {
        throw new AppException(STUDENT_ERRORS.CREDENTIALS_ALREADY_DOWNLOADED);
      }
      if (
        delivery.expiresAt.getTime() <= now.getTime() ||
        !delivery.ciphertext ||
        !delivery.iv ||
        !delivery.authTag ||
        !delivery.keyId
      ) {
        throw new AppException(STUDENT_ERRORS.CREDENTIALS_EXPIRED);
      }
      let content: Uint8Array;
      try {
        content = decryptStudentCredentials(
          {
            ciphertext: delivery.ciphertext,
            iv: delivery.iv,
            authTag: delivery.authTag,
            keyId: delivery.keyId,
          },
          this.key(),
          batchId,
          access.userId,
        );
      } catch (error) {
        if (error instanceof AppException) throw error;
        throw new AppException(STUDENT_ERRORS.CREDENTIALS_UNREADABLE);
      }
      await tx.studentCredentialDelivery.update({
        where: { batchId },
        data: {
          downloadedAt: now,
          ciphertext: null,
          iv: null,
          authTag: null,
          keyId: null,
        },
      });
      return {
        content,
        fileName: `${CREDENTIAL_SHEET.fileNamePrefix}${batchId}.xlsx`,
      };
    });
  }

  // Keeps the count and timestamps; only the encrypted payload goes.
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.studentCredentialDelivery.updateMany({
      where: { expiresAt: { lte: now }, ciphertext: { not: null } },
      data: { ciphertext: null, iv: null, authTag: null, keyId: null },
    });
    return count;
  }

  private key(): Uint8Array {
    return credentialKeyFrom(
      this.config.get('STUDENT_CREDENTIAL_ENCRYPTION_KEY', { infer: true }),
    );
  }

  // The R1 import gate is rechecked on every call, so a revoked grant stops a download that was available a minute ago.
  private async assertOwnBatch(
    db: Pick<Prisma.TransactionClient, 'importBatch'>,
    batchId: string,
    access: AccessContext,
  ): Promise<void> {
    assertStudentImport(access);
    const batch = await db.importBatch.findFirst({
      where: {
        id: batchId,
        importType: ImportType.STUDENT_LIST,
        status: ImportBatchStatus.COMMITTED,
        performedById: access.userId,
      },
      select: { id: true },
    });
    if (!batch) throw new AppException(IMPORT_ERRORS.BATCH_NOT_FOUND);
  }

  private async buildWorkbook(
    accounts: readonly PreparedStudentAccount[],
  ): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(CREDENTIAL_SHEET.sheetName);
    const heading = sheet.addRow([...CREDENTIAL_SHEET.headers]);
    heading.font = { bold: true };
    CREDENTIAL_SHEET.headers.forEach((_, index) => {
      const column = sheet.getColumn(index + 1);
      column.width = CREDENTIAL_SHEET.width;
      column.numFmt = '@';
    });
    for (const account of accounts) {
      sheet.addRow([
        account.studentCode,
        account.username,
        account.temporaryPassword,
      ]);
    }
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }
}
