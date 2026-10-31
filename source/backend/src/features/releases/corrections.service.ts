import { Injectable, Logger } from '@nestjs/common';
import {
  ProgramVersionStatus,
  type Prisma,
  type ProgramVersion,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { assertSchoolWideDirect } from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { lockRequisiteGraph } from '../../shared/courses/requisite-graph.js';
import { ConsistencyChecker } from '../../shared/curriculum/consistency-checker.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { VersionContentCopier } from '../../shared/programs/version-content.copier.js';
import { versionCopyFields } from '../../shared/programs/version-fields.js';
import {
  lockPrograms,
  RELEASE_TRANSACTION,
} from '../../shared/releases/release-locks.js';
import { RELEASE_ERRORS } from '../../shared/releases/release.errors.js';
import { requireSemesterStart } from '../../shared/releases/semester-start.js';
import { assertNoSyllabusIssues } from '../../shared/releases/syllabus-release-issues.js';
import { VersionActivator } from '../../shared/releases/version.activator.js';
import {
  nextReleaseNumber,
  VERSION_BUMP,
} from '../../shared/releases/version-number.js';
import {
  VersionPublisher,
  type ReleasedStatus,
} from '../../shared/releases/version.publisher.js';
import { todayDate } from '../../shared/time/today.js';
import { IssueCorrectionDto } from './dto/release-version.dto.js';
import type { VersionDetailDto } from './dto/version-detail.dto.js';
import { VersionHistoryReader } from './version-history.reader.js';

// MH-49 (US-076): R1 corrects a mistaken released version in a Draft of its own and issues it as the next minor number.
// The corrected version stays in history; nobody edits a published version in place.
@Injectable()
export class CorrectionsService {
  private readonly logger = new Logger(CorrectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly copier: VersionContentCopier,
    private readonly publisher: VersionPublisher,
    private readonly activator: VersionActivator,
    private readonly consistency: ConsistencyChecker,
    private readonly history: VersionHistoryReader,
  ) {}

  // Opening the correction twice returns the same Draft, so a refresh never makes a second one.
  async create(
    programId: string,
    versionId: string,
    access: AccessContext,
  ): Promise<VersionDetailDto> {
    assertSchoolWideDirect(access, PERMISSIONS.VERSION_CORRECT);
    const draftId = await this.prisma.$transaction(async (tx) => {
      await lockPrograms(tx, [programId]);
      const base = await correctableVersion(tx, programId, versionId);
      const open = await tx.programVersion.findUnique({
        where: { correctionOfId: base.id },
        select: { id: true, status: true },
      });
      if (open) {
        if (open.status !== ProgramVersionStatus.DRAFT) {
          throw new AppException(RELEASE_ERRORS.VERSION_NOT_CORRECTABLE);
        }
        return open.id;
      }
      const draft = await tx.programVersion.create({
        data: {
          programId,
          status: ProgramVersionStatus.DRAFT,
          correctionOfId: base.id,
          ...versionCopyFields(base),
        },
        select: { id: true },
      });
      await this.copier.copy(tx, base.id, draft.id);
      return draft.id;
    }, RELEASE_TRANSACTION);
    this.logger.log(`Correction Draft ${draftId} opened by ${access.userId}`);
    return this.history.detail(programId, draftId, access);
  }

  async issue(
    programId: string,
    versionId: string,
    correctionId: string,
    dto: IssueCorrectionDto,
    access: AccessContext,
  ): Promise<VersionDetailDto> {
    assertSchoolWideDirect(access, PERMISSIONS.VERSION_CORRECT);
    const releasedId = await this.prisma.$transaction(async (tx) => {
      await lockPrograms(tx, [programId]);
      const original = await correctableVersion(tx, programId, versionId);
      const draft = await correctionDraft(
        tx,
        programId,
        original.id,
        correctionId,
      );
      await lockRequisiteGraph(tx);
      await this.consistency.assertPasses(draft.id, tx);
      await assertNoSyllabusIssues(tx, draft.id);
      const numbers = await tx.programVersion.findMany({
        where: { programId, versionNumber: { not: null } },
        select: { versionNumber: true },
      });
      const number = nextReleaseNumber(
        original.versionNumber!,
        numbers.map((row) => row.versionNumber),
        VERSION_BUMP.MINOR,
      );
      const semester = await requireSemesterStart(
        tx,
        original.effectiveSemesterId!,
      );
      await tx.programVersion.update({
        where: { id: original.id },
        data: { status: ProgramVersionStatus.HISTORICAL },
      });
      const released = await this.publisher.promote(tx, {
        versionId: draft.id,
        programId,
        versionNumber: number,
        decisionNumber: original.decisionNumber,
        signedDate: original.signedDate,
        effectiveSemesterId: semester.id,
        effectiveStart: semester.startDate,
        statusOverride: original.status as ReleasedStatus,
        publisherId: access.userId,
        now: new Date(),
        today: todayDate(),
        previousVersionId: original.id,
        originRequestId: original.originRequestId ?? undefined,
        correctionOfId: original.id,
        correctionReason: dto.reason,
        cohortIds: [],
      });
      if (dto.moveCohorts ?? true) {
        await tx.cohortVersion.updateMany({
          where: { programVersionId: original.id },
          data: { programVersionId: released.id },
        });
      }
      // A correction of a Pending version whose semester has begun since is activated now, not tomorrow.
      if (released.status === ProgramVersionStatus.PENDING) {
        await this.activator.activate(tx, released.id);
      }
      return released.id;
    }, RELEASE_TRANSACTION);
    this.logger.log(
      `Version ${versionId} corrected by ${releasedId} (${access.userId})`,
    );
    return this.history.detail(programId, releasedId, access);
  }

  // Only an unissued correction can go: once issued it is history (PB-09).
  async discard(
    programId: string,
    versionId: string,
    correctionId: string,
    access: AccessContext,
  ): Promise<void> {
    assertSchoolWideDirect(access, PERMISSIONS.VERSION_CORRECT);
    await this.prisma.$transaction(async (tx) => {
      await lockPrograms(tx, [programId]);
      await correctionDraft(tx, programId, versionId, correctionId);
      await tx.programVersion.delete({ where: { id: correctionId } });
    });
    this.logger.log(
      `Correction Draft ${correctionId} discarded by ${access.userId}`,
    );
  }
}

// Active or Pending only: a Historical or Draft version is not what is (or is about to be) in force.
async function correctableVersion(
  tx: Prisma.TransactionClient,
  programId: string,
  versionId: string,
): Promise<ProgramVersion> {
  const version = await tx.programVersion.findFirst({
    where: { id: versionId, programId, sourceRequestId: null },
  });
  if (!version) throw new AppException(RELEASE_ERRORS.VERSION_NOT_FOUND);
  if (
    version.status !== ProgramVersionStatus.ACTIVE &&
    version.status !== ProgramVersionStatus.PENDING
  ) {
    throw new AppException(RELEASE_ERRORS.VERSION_NOT_CORRECTABLE);
  }
  return version;
}

async function correctionDraft(
  tx: Prisma.TransactionClient,
  programId: string,
  originalId: string,
  correctionId: string,
): Promise<ProgramVersion> {
  const draft = await tx.programVersion.findFirst({
    where: {
      id: correctionId,
      programId,
      correctionOfId: originalId,
      status: ProgramVersionStatus.DRAFT,
    },
  });
  if (!draft) throw new AppException(RELEASE_ERRORS.CORRECTION_NOT_FOUND);
  return draft;
}
