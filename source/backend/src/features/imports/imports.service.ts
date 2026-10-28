import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  ImportBatchStatus,
  ImportType,
  ProgramVersionStatus,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import { uploadedFileName } from '../../shared/files/uploaded-file-name.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  assertStudentImport,
  holdsStudentImport,
} from '../../shared/students/student-access.js';
import { CreateImportDto, ImportListQueryDto } from './dto/import.dto.js';
import type {
  ImportBatchDetailDto,
  ImportTypeOptionDto,
} from './dto/import-response.dto.js';
import {
  assertCatalogImport,
  assertCurriculumImport,
  assertSupported,
  IMPORT_TYPE_SUPPORT,
  IMPORT_VERSION_SELECT,
  isStudentImportType,
  programScope,
} from './import-access.js';
import {
  DAY_MS,
  IMPORT_JOB,
  IMPORT_LIMITS,
  IMPORT_QUEUE,
  XLSX_EXTENSION,
  type ImportJobData,
  type ImportJobName,
} from './import.constants.js';
import { IMPORT_ERRORS } from './import-errors.js';
import {
  BATCH_DETAIL_SELECT,
  fromReportJson,
  jobOptions,
  toDetailDto,
  toReportJson,
} from './import-mapping.js';
import { readImportSheet } from './import-validation.js';
import { ImportsReader } from './imports.reader.js';
import {
  ACADEMIC_RESULT_SHEET,
  RESULT_IDENTITY_COLUMNS,
} from './sheets/academic-result.sheet.js';
import { COURSE_CATALOG_SHEET } from './sheets/course-catalog.sheet.js';
import { CURRICULUM_SHEET } from './sheets/curriculum.sheet.js';
import { writeTemplate } from './sheets/sheet-writer.js';
import {
  STUDENT_IDENTITY_COLUMNS,
  STUDENT_LIST_SHEET,
} from './sheets/student-list.sheet.js';
import {
  ACADEMIC_RESULT_INSTRUCTIONS,
  STUDENT_LIST_INSTRUCTIONS,
  writeIdentityTemplate,
} from './sheets/student-template.js';
import { StudentCredentialsService } from './student-credentials.service.js';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(IMPORT_QUEUE)
    private readonly queue: Queue<ImportJobData, void, ImportJobName>,
    private readonly reader: ImportsReader,
    private readonly credentials: StudentCredentialsService,
  ) {}

  types(access: AccessContext): ImportTypeOptionDto[] {
    const types: ImportTypeOptionDto[] = [];
    if (access.scopeFor(PERMISSIONS.DATA_IMPORT_EXCEL).all)
      types.push({
        importType: ImportType.COURSE_CATALOG,
        needsVersion: false,
      });
    if (access.has(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL))
      types.push({ importType: ImportType.CURRICULUM, needsVersion: true });
    if (holdsStudentImport(access))
      types.push(
        { importType: ImportType.STUDENT_LIST, needsVersion: false },
        { importType: ImportType.ACADEMIC_RESULT, needsVersion: false },
      );
    return types;
  }

  async curriculumTargets(access: AccessContext) {
    if (!access.has(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL))
      throw new AppException(COMMON_ERRORS.PERMISSION_DENIED);
    const rows = await this.prisma.programVersion.findMany({
      where: {
        status: ProgramVersionStatus.DRAFT,
        sourceRequestId: null,
        correctionOfId: null,
        program: {
          AND: [
            programScope(access),
            {
              versions: {
                none: { status: { not: ProgramVersionStatus.DRAFT } },
              },
            },
          ],
        },
      },
      select: {
        id: true,
        programId: true,
        programName: true,
        program: { select: { programCode: true } },
      },
      orderBy: { program: { programCode: 'asc' } },
    });
    return rows.map((row) => ({
      versionId: row.id,
      programId: row.programId,
      programCode: row.program.programCode,
      programName: row.programName,
    }));
  }

  async template(importType: ImportType, access: AccessContext) {
    assertSupported(importType);
    if (isStudentImportType(importType)) {
      assertStudentImport(access);
      return {
        content:
          importType === ImportType.STUDENT_LIST
            ? await writeIdentityTemplate(
                STUDENT_LIST_SHEET,
                STUDENT_IDENTITY_COLUMNS,
                STUDENT_LIST_INSTRUCTIONS,
              )
            : await writeIdentityTemplate(
                ACADEMIC_RESULT_SHEET,
                RESULT_IDENTITY_COLUMNS,
                ACADEMIC_RESULT_INSTRUCTIONS,
              ),
        fileName: `${importType}_mau${XLSX_EXTENSION}`,
      };
    }
    if (importType === ImportType.COURSE_CATALOG) assertCatalogImport(access);
    else if (!access.has(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL))
      throw new AppException(COMMON_ERRORS.PERMISSION_DENIED);
    return {
      content: await writeTemplate(
        importType === ImportType.COURSE_CATALOG
          ? COURSE_CATALOG_SHEET
          : CURRICULUM_SHEET,
      ),
      fileName: `${importType}_mau${XLSX_EXTENSION}`,
    };
  }

  async create(
    file: Express.Multer.File | undefined,
    dto: CreateImportDto,
    access: AccessContext,
  ): Promise<ImportBatchDetailDto> {
    if (!file) throw new AppException(IMPORT_ERRORS.FILE_REQUIRED);
    const fileName = uploadedFileName(file.originalname);
    if (!fileName.toLowerCase().endsWith(XLSX_EXTENSION))
      throw new AppException(IMPORT_ERRORS.FILE_NOT_XLSX);
    if (file.buffer.byteLength > IMPORT_LIMITS.FILE_MAX_BYTES)
      throw new PayloadTooLargeException();
    assertSupported(dto.importType);
    if (IMPORT_TYPE_SUPPORT[dto.importType].needsVersion && !dto.versionId)
      throw new AppException(IMPORT_ERRORS.VERSION_REQUIRED);
    if (!IMPORT_TYPE_SUPPORT[dto.importType].needsVersion && dto.versionId)
      throw new AppException(IMPORT_ERRORS.VERSION_NOT_ALLOWED);
    const version = dto.versionId
      ? await this.assertVersion(dto.versionId, access)
      : null;
    if (isStudentImportType(dto.importType)) {
      assertStudentImport(access);
      if (dto.importType === ImportType.STUDENT_LIST)
        this.credentials.assertConfigured();
    } else if (!version) assertCatalogImport(access);
    const parsed = await readImportSheet(dto.importType, file.buffer);
    const invalid = parsed.sheet.formatErrors.length > 0;
    const row = await this.prisma.importBatch.create({
      data: {
        importType: dto.importType,
        fileName,
        performedById: access.userId,
        programId: version?.programId ?? null,
        versionId: version?.id ?? null,
        status: invalid
          ? ImportBatchStatus.ABORTED
          : ImportBatchStatus.VALIDATING,
        totalRows: invalid ? parsed.sheet.rows.length : 0,
        errorRows: invalid ? parsed.sheet.rows.length : 0,
        ...(invalid
          ? {
              errorReport: toReportJson({
                formatErrors: parsed.sheet.formatErrors,
                issues: [],
              }),
              finishedAt: new Date(),
            }
          : {}),
        file: {
          create: {
            content: new Uint8Array(file.buffer),
            sizeBytes: file.buffer.byteLength,
            expiresAt: new Date(
              Date.now() + IMPORT_LIMITS.FILE_RETENTION_DAYS * DAY_MS,
            ),
          },
        },
      },
      select: BATCH_DETAIL_SELECT,
    });
    if (!invalid)
      await this.queue.add(
        IMPORT_JOB.VALIDATE,
        { batchId: row.id },
        jobOptions(IMPORT_JOB.VALIDATE, row.id),
      );
    return toDetailDto(row, access.userId);
  }

  list(query: ImportListQueryDto, access: AccessContext) {
    return this.reader.list(query, access);
  }
  detail(batchId: string, access: AccessContext) {
    return this.reader.detail(batchId, access);
  }
  file(batchId: string, access: AccessContext) {
    return this.reader.file(batchId, access);
  }

  async commit(
    batchId: string,
    access: AccessContext,
  ): Promise<ImportBatchDetailDto> {
    const batch = await this.reader.visible(batchId, access);
    if (batch.performedById !== access.userId)
      throw new AppException(IMPORT_ERRORS.NOT_OWNER);
    if (batch.importType === ImportType.CURRICULUM) {
      if (!batch.versionId)
        throw new AppException(IMPORT_ERRORS.VERSION_NOT_FOUND);
      await this.assertVersion(batch.versionId, access);
    } else if (isStudentImportType(batch.importType)) {
      assertStudentImport(access);
      if (batch.importType === ImportType.STUDENT_LIST)
        this.credentials.assertConfigured();
    } else assertCatalogImport(access);
    const report = fromReportJson(batch.errorReport);
    if (
      batch.errorRows ||
      report?.formatErrors.length ||
      report?.issues.some((issue) => issue.severity === 'ERROR')
    )
      throw new AppException(IMPORT_ERRORS.HAS_ERRORS);
    if (!batch.file || batch.file.expiresAt <= new Date())
      throw new AppException(IMPORT_ERRORS.FILE_EXPIRED);
    const changed = await this.prisma.importBatch.updateMany({
      where: {
        id: batchId,
        status: ImportBatchStatus.DRY_RUN,
        file: { is: { expiresAt: { gt: new Date() } } },
      },
      data: { status: ImportBatchStatus.COMMITTING, finishedAt: new Date() },
    });
    if (!changed.count) throw new AppException(IMPORT_ERRORS.NOT_COMMITTABLE);
    await this.queue.add(
      IMPORT_JOB.COMMIT,
      { batchId },
      jobOptions(IMPORT_JOB.COMMIT, batchId),
    );
    return this.reader.detail(batchId, access);
  }

  private async assertVersion(versionId: string, access: AccessContext) {
    const version = await this.prisma.programVersion.findUnique({
      where: { id: versionId },
      select: IMPORT_VERSION_SELECT,
    });
    if (!version) throw new AppException(IMPORT_ERRORS.VERSION_NOT_FOUND);
    await assertCurriculumImport(this.prisma, access, version);
    return version;
  }
}
