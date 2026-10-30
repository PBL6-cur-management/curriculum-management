import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { REQUEST_DRAFT_ERRORS } from '../../shared/change-requests/change-request.errors.js';
import { AppException } from '../../shared/exception/app.exception.js';
import {
  detectAttachmentType,
  mimeForPath,
} from '../../shared/files/attachment-types.js';
import { FileStorageService } from '../../shared/files/file-storage.service.js';
import { uploadedFileName } from '../../shared/files/uploaded-file-name.js';
import { USER_REF_SELECT } from '../../shared/dtos/ref.dto.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { courseTarget } from '../../shared/courses/course-target.js';
import {
  SyllabusStatus,
  type SyllabusMaterialKind,
} from '../../generated/prisma/client.js';
import {
  assertDraftWrite,
  assertRevisionVisible,
  SYLLABUS_ACCESS_SELECT,
  type SyllabusAccessRow,
} from './syllabus-access.js';
import {
  toAttachmentDto,
  type SyllabusAttachmentDto,
} from './syllabus-attachment.dto.js';
import { SYLLABUS_ERRORS, SYLLABUS_LIMITS } from './syllabus.errors.js';

const SYLLABUS_FILES_DIR = 'syllabi';

// Files are written first and removed last: a failure leaves at worst an unreferenced file,
// never a row that points at nothing.
@Injectable()
export class SyllabusAttachmentsService {
  private readonly logger = new Logger(SyllabusAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileStorageService,
  ) {}

  async upload(
    syllabusId: string,
    file: Express.Multer.File | undefined,
    materialKind: SyllabusMaterialKind,
    access: AccessContext,
  ): Promise<SyllabusAttachmentDto> {
    const found = await this.prisma.syllabus.findUnique({
      where: { id: syllabusId },
      select: SYLLABUS_ACCESS_SELECT,
    });
    // A published revision only ever gains signed files (US-077); a Draft takes the ordinary write rules.
    const revision =
      found && found.status !== SyllabusStatus.DRAFT
        ? this.assertCanAttach(found, access)
        : await assertDraftWrite(this.prisma, access, found);
    if (revision.sourceRequest) {
      throw new AppException(REQUEST_DRAFT_ERRORS.COPY_HAS_NO_ATTACHMENTS);
    }
    if (!file) {
      throw new AppException(SYLLABUS_ERRORS.ATTACHMENT_FILE_REQUIRED);
    }
    const fileName = uploadedFileName(file.originalname);
    const content = new Uint8Array(file.buffer);
    const spec = detectAttachmentType(fileName, content);
    if (!spec) {
      throw new AppException(SYLLABUS_ERRORS.ATTACHMENT_TYPE_NOT_ALLOWED);
    }
    const held = await this.prisma.syllabusAttachment.count({
      where: { syllabusId },
    });
    if (held >= SYLLABUS_LIMITS.ATTACHMENTS_MAX) {
      throw new AppException(SYLLABUS_ERRORS.ATTACHMENT_LIMIT_REACHED);
    }
    const filePath = path.posix.join(
      SYLLABUS_FILES_DIR,
      revision.id,
      `${randomUUID()}${spec.extension}`,
    );
    await this.files.write(filePath, content);
    try {
      const row = await this.prisma.syllabusAttachment.create({
        data: {
          syllabusId,
          materialKind,
          fileName,
          fileType: spec.type,
          filePath,
          sizeBytes: content.byteLength,
          uploadedById: access.userId,
        },
        include: { uploadedBy: { select: USER_REF_SELECT } },
      });
      return toAttachmentDto(row, true);
    } catch (error) {
      await this.files.remove(filePath);
      throw error;
    }
  }

  private assertCanAttach(
    row: SyllabusAccessRow,
    access: AccessContext,
  ): SyllabusAccessRow {
    assertRevisionVisible(row, access);
    access.assertCan(PERMISSIONS.SYLLABUS_EDIT, courseTarget(row.course));
    return row;
  }

  async open(
    attachmentId: string,
    access: AccessContext,
  ): Promise<{ stream: Readable; fileName: string; mime: string }> {
    const row = await this.prisma.syllabusAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        fileName: true,
        filePath: true,
        syllabus: { select: SYLLABUS_ACCESS_SELECT },
      },
    });
    if (!row) {
      throw new AppException(SYLLABUS_ERRORS.ATTACHMENT_NOT_FOUND);
    }
    assertRevisionVisible(row.syllabus, access);
    const { stream } = await this.files.open(row.filePath);
    return {
      stream,
      fileName: row.fileName,
      mime: mimeForPath(row.filePath),
    };
  }

  // The uploader check comes after the draft/direct-edit checks, so a request holder on a
  // released syllabus is told to file a change request, not "not the uploader".
  async remove(attachmentId: string, access: AccessContext): Promise<void> {
    const row = await this.prisma.syllabusAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        filePath: true,
        uploadedById: true,
        syllabus: { select: SYLLABUS_ACCESS_SELECT },
      },
    });
    if (!row) {
      throw new AppException(SYLLABUS_ERRORS.ATTACHMENT_NOT_FOUND);
    }
    // Published signed files never go (D15): the lock answers before any permission question.
    if (row.syllabus.status !== SyllabusStatus.DRAFT) {
      throw new AppException(SYLLABUS_ERRORS.ATTACHMENT_LOCKED);
    }
    const revision = await assertDraftWrite(this.prisma, access, row.syllabus);
    if (revision.sourceRequest) {
      throw new AppException(REQUEST_DRAFT_ERRORS.COPY_HAS_NO_ATTACHMENTS);
    }
    if (row.uploadedById !== access.userId) {
      throw new AppException(SYLLABUS_ERRORS.ATTACHMENT_NOT_UPLOADER);
    }
    await this.prisma.syllabusAttachment.delete({ where: { id: row.id } });
    await this.files
      .remove(row.filePath)
      .catch((error: unknown) =>
        this.logger.warn(
          `Orphan file left: ${row.filePath} (${String(error)})`,
        ),
      );
  }
}
