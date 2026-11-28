import { Injectable, Optional } from '@nestjs/common';
import {
  ProgramVersionStatus,
  SyllabusStatus,
  type ChangeRequestType,
  type ChangeTargetType,
  type Prisma,
} from '../../generated/prisma/client.js';
import { newestReleasedVersion } from '../../shared/change-requests/released-base.js';
import {
  WORKSPACE_KIND,
  workspaceKindFor,
} from '../../shared/change-requests/request-kinds.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { FileStorageService } from '../../shared/files/file-storage.service.js';
import { versionCopyFields } from '../../shared/programs/version-fields.js';
import { VersionContentCopier } from '../../shared/programs/version-content.copier.js';
import { copySyllabusRevision } from '../../shared/syllabi/syllabus-revision.copier.js';
import { CHANGE_REQUEST_ERRORS } from './change-request-feature.errors.js';

export interface CopyOwner {
  id: string;
  requestType: ChangeRequestType;
  targetType: ChangeTargetType;
  programId: string | null;
  courseId: string | null;
}

// A workspace request edits a copy of what is in force (D1): a program version or a syllabus revision whose
// sourceRequestId points back at the request. Every reader that must not see copies filters sourceRequestId: null.
@Injectable()
export class WorkingCopyService {
  constructor(
    private readonly versionCopier: VersionContentCopier,
    @Optional() private readonly files?: FileStorageService,
  ) {}

  async create(
    tx: Prisma.TransactionClient,
    request: CopyOwner,
  ): Promise<void> {
    const kind = workspaceKindFor(request.requestType, request.targetType);
    if (kind === WORKSPACE_KIND.PROGRAM_VERSION) {
      await this.copyProgramVersion(tx, request.id, request.programId!);
    } else if (kind === WORKSPACE_KIND.SYLLABUS) {
      await this.copySyllabus(tx, request.id, request.courseId!);
    }
  }

  // Cascades take the copy's rows; a syllabus copy never has attachments (BE-02).
  async discard(
    tx: Prisma.TransactionClient,
    requestId: string,
  ): Promise<void> {
    await tx.programVersion.deleteMany({
      where: { sourceRequestId: requestId },
    });
    await tx.syllabus.deleteMany({ where: { sourceRequestId: requestId } });
  }

  // D12: a fresh copy of the newest base; edits on the old copy are discarded.
  async rebase(
    tx: Prisma.TransactionClient,
    request: CopyOwner,
  ): Promise<void> {
    await this.discard(tx, request.id);
    await this.create(tx, request);
  }

  private async copyProgramVersion(
    tx: Prisma.TransactionClient,
    requestId: string,
    programId: string,
  ): Promise<void> {
    const base = await newestReleasedVersion(tx, programId);
    if (!base) {
      throw new AppException(CHANGE_REQUEST_ERRORS.TARGET_NOT_RELEASED);
    }
    // versionNumber stays null until the final approval numbers the release.
    const copy = await tx.programVersion.create({
      data: {
        programId,
        status: ProgramVersionStatus.DRAFT,
        ...versionCopyFields(base),
        sourceRequestId: requestId,
        baseVersionId: base.id,
      },
      select: { id: true },
    });
    await this.versionCopier.copy(tx, base.id, copy.id);
  }

  private async copySyllabus(
    tx: Prisma.TransactionClient,
    requestId: string,
    courseId: string,
  ): Promise<void> {
    const base = await tx.syllabus.findFirst({
      where: { courseId, status: SyllabusStatus.PUBLISHED },
      select: { id: true },
    });
    if (!base) {
      throw new AppException(CHANGE_REQUEST_ERRORS.TARGET_NOT_RELEASED);
    }
    await copySyllabusRevision(
      tx,
      base.id,
      { sourceRequestId: requestId },
      this.files,
    );
  }
}
