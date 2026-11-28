import { Injectable, Logger } from '@nestjs/common';
import {
  ProgramVersionStatus,
  type ChangeRequest,
  type Prisma,
  type ProgramVersion,
} from '../../generated/prisma/client.js';
import {
  AUTHORED_OPERATION,
  OPERATIONS_BY_TYPE,
  type AuthoredPayload,
} from '../../shared/change-requests/authored-item.types.js';
import { newestReleasedVersion } from '../../shared/change-requests/released-base.js';
import {
  WORKSPACE_KIND,
  workspaceKindFor,
} from '../../shared/change-requests/request-kinds.js';
import { applyApprovedCourseField } from '../../shared/courses/course.writer.js';
import {
  createRelation,
  removeRelation,
  updateRelationMinScore,
} from '../../shared/courses/course-relation.writer.js';
import { ConsistencyChecker } from '../../shared/curriculum/consistency-checker.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { VersionContentCopier } from '../../shared/programs/version-content.copier.js';
import { versionCopyFields } from '../../shared/programs/version-fields.js';
import { newestVersionsContainingCourse } from '../../shared/releases/fan-out-targets.js';
import {
  lockCourses,
  lockPrograms,
} from '../../shared/releases/release-locks.js';
import { RELEASE_ERRORS } from '../../shared/releases/release.errors.js';
import {
  assertCohortsExist,
  type StartedSemester,
} from '../../shared/releases/semester-start.js';
import { SyllabusPublisher } from '../../shared/releases/syllabus.publisher.js';
import { assertNoSyllabusIssues } from '../../shared/releases/syllabus-release-issues.js';
import {
  repointCourseLinks,
  VersionPublisher,
} from '../../shared/releases/version.publisher.js';
import {
  bumpForRequest,
  nextReleaseNumber,
  VERSION_BUMP,
  type VersionBump,
} from '../../shared/releases/version-number.js';
import { fromIsoDay } from '../../shared/time/today.js';
import type { FinalApproveDto } from './final-approval.dto.js';

export interface ApplyContext {
  dto: FinalApproveDto;
  semester: StartedSemester;
  actorId: string;
  now: Date;
  today: Date;
}

// DX-10 / US-075: the request's content becomes versions (or catalog changes) inside the approval's transaction.
// Anything that throws rolls the whole approval back and the request stays at level 3.
@Injectable()
export class FinalApprovalApplier {
  private readonly logger = new Logger(FinalApprovalApplier.name);

  constructor(
    private readonly consistency: ConsistencyChecker,
    private readonly publisher: VersionPublisher,
    private readonly syllabi: SyllabusPublisher,
    private readonly copier: VersionContentCopier,
  ) {}

  async apply(
    tx: Prisma.TransactionClient,
    request: ChangeRequest,
    context: ApplyContext,
  ): Promise<ProgramVersion[]> {
    await assertCohortsExist(tx, context.dto.cohortIds ?? []);
    const kind = workspaceKindFor(request.requestType, request.targetType);
    if (kind === WORKSPACE_KIND.PROGRAM_VERSION) {
      return [await this.promoteProgramCopy(tx, request, context)];
    }
    if (kind === WORKSPACE_KIND.SYLLABUS) {
      return this.publishSyllabus(tx, request, context);
    }
    if (context.dto.cohortIds?.length) {
      throw new AppException(RELEASE_ERRORS.COHORTS_NOT_ALLOWED);
    }
    await this.applyAuthoredItems(tx, request);
    return [];
  }

  // CURRICULUM, PROGRAM_INFO and program-level OUTCOME: the working copy is the next version of its program.
  private async promoteProgramCopy(
    tx: Prisma.TransactionClient,
    request: ChangeRequest,
    context: ApplyContext,
  ): Promise<ProgramVersion> {
    const copy = await tx.programVersion.findUniqueOrThrow({
      where: { sourceRequestId: request.id },
    });
    await lockPrograms(tx, [copy.programId]);
    const base = await newestReleasedVersion(tx, copy.programId);
    if (!base) throw new AppException(RELEASE_ERRORS.ITEM_APPLY_FAILED);
    await assertNotBeforeBase(tx, base, context.semester);
    await this.consistency.assertPasses(copy.id, tx);
    await assertNoSyllabusIssues(tx, copy.id);
    return this.promote(
      tx,
      request,
      copy.id,
      base,
      bumpForRequest(request),
      context,
    );
  }

  // SYLLABUS_CONTENT, GRADING_FORMULA and course-level OUTCOME: the copy is published as the next revision FIRST,
  // then every program holding the course gets a new minor version pinned to it.
  // Resilient fan-out: when multiple programs share the course, a pre-existing issue on one program logs a warning
  // and skips that program instead of rolling back the entire syllabus update.
  private async publishSyllabus(
    tx: Prisma.TransactionClient,
    request: ChangeRequest,
    context: ApplyContext,
  ): Promise<ProgramVersion[]> {
    const courseId = request.courseId!;
    const copy = await tx.syllabus.findUniqueOrThrow({
      where: { sourceRequestId: request.id },
    });
    // Programs first, then the course: the order a release of one of those programs takes its locks in.
    const known = await newestVersionsContainingCourse(tx, courseId);
    await lockPrograms(
      tx,
      known.map((target) => target.programId),
    );
    await lockCourses(tx, [courseId]);
    const targets = await newestVersionsContainingCourse(tx, courseId);
    const { revision } = await this.syllabi.publishFromRequest(
      tx,
      copy.id,
      request.id,
      context.now,
      {
        effectiveSemesterId: context.semester.id,
        documentNumber:
          context.dto.decisionNumber || request.basisDocumentNumber || null,
        signedDate: fromIsoDay(context.dto.signedDate),
      },
    );
    const released: ProgramVersion[] = [];
    const multiProgram = targets.length > 1;
    for (const target of targets) {
      let shellId: string | null = null;
      try {
        await assertNotBeforeBase(tx, target, context.semester);
        const shell = await tx.programVersion.create({
          data: {
            programId: target.programId,
            status: ProgramVersionStatus.DRAFT,
            ...versionCopyFields(target),
          },
          select: { id: true },
        });
        shellId = shell.id;
        await this.copier.copy(tx, target.id, shell.id);
        await tx.curriculumItem.updateMany({
          where: { versionId: shell.id, courseId },
          data: { syllabusId: revision.id },
        });
        await repointCourseLinks(tx, shell.id, courseId, revision.id);
        await this.consistency.assertPasses(shell.id, tx);
        released.push(
          await this.promote(
            tx,
            request,
            shell.id,
            target,
            VERSION_BUMP.MINOR,
            context,
          ),
        );
      } catch (error) {
        if (!multiProgram || !(error instanceof AppException)) {
          throw error;
        }
        if (shellId) {
          await tx.programVersion.delete({ where: { id: shellId } });
        }
        this.logger.warn(
          `Resilient fan-out skipped program ${target.programId} (${target.program?.programCode ?? target.programId}) for request ${request.requestCode}: ${error.code} — ${error.message}`,
        );
      }
    }
    return released;
  }

  private async promote(
    tx: Prisma.TransactionClient,
    request: ChangeRequest,
    versionId: string,
    base: ProgramVersion,
    bump: VersionBump,
    context: ApplyContext,
  ): Promise<ProgramVersion> {
    const numbers = await tx.programVersion.findMany({
      where: { programId: base.programId, versionNumber: { not: null } },
      select: { versionNumber: true },
    });
    return this.publisher.promote(tx, {
      versionId,
      programId: base.programId,
      versionNumber: nextReleaseNumber(
        base.versionNumber!,
        numbers.map((row) => row.versionNumber),
        bump,
      ),
      decisionNumber: context.dto.decisionNumber,
      signedDate: fromIsoDay(context.dto.signedDate),
      effectiveSemesterId: context.semester.id,
      effectiveStart: context.semester.startDate,
      publisherId: context.actorId,
      now: context.now,
      today: context.today,
      previousVersionId: base.id,
      originRequestId: request.id,
      cohortIds: context.dto.cohortIds ?? [],
    });
  }

  // COURSE_RELATION: each authored item runs through the writer that owns the rule, in authored order.
  // A refusal names the item and rolls everything back.
  private async applyAuthoredItems(
    tx: Prisma.TransactionClient,
    request: ChangeRequest,
  ): Promise<void> {
    const allowed = OPERATIONS_BY_TYPE[request.requestType] ?? [];
    const items = await tx.changeItem.findMany({
      where: { changeRequestId: request.id },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    for (const item of items) {
      const payload = item.newValue as unknown as AuthoredPayload;
      try {
        if (!allowed.includes(payload.operation)) {
          throw new AppException(RELEASE_ERRORS.ITEM_APPLY_FAILED);
        }
        await this.applyOne(tx, request, payload);
      } catch (error) {
        if (!(error instanceof AppException)) throw error;
        throw new AppException(RELEASE_ERRORS.ITEM_APPLY_FAILED, [
          { field: item.label, constraints: [error.code] },
        ]);
      }
    }
  }

  private async applyOne(
    tx: Prisma.TransactionClient,
    request: ChangeRequest,
    payload: AuthoredPayload,
  ): Promise<void> {
    switch (payload.operation) {
      case AUTHORED_OPERATION.SET_COURSE_FIELD:
        await applyApprovedCourseField(
          tx,
          request.courseId!,
          payload.field,
          payload.value,
        );
        return;
      case AUTHORED_OPERATION.ADD_RELATION:
        await createRelation(tx, payload);
        return;
      case AUTHORED_OPERATION.UPDATE_RELATION:
        await updateRelationMinScore(tx, payload.relationId, payload.minScore);
        return;
      case AUTHORED_OPERATION.REMOVE_RELATION:
        await removeRelation(tx, payload.relationId);
        return;
      default:
        throw new AppException(RELEASE_ERRORS.ITEM_APPLY_FAILED);
    }
  }
}

// A version never takes effect before the one it builds on (a Pending base would otherwise overwrite it on activation).
async function assertNotBeforeBase(
  tx: Prisma.TransactionClient,
  base: { effectiveSemesterId: string | null },
  semester: StartedSemester,
): Promise<void> {
  if (!base.effectiveSemesterId) return;
  const baseSemester = await tx.semester.findUnique({
    where: { id: base.effectiveSemesterId },
    select: { startDate: true },
  });
  if (baseSemester?.startDate && baseSemester.startDate > semester.startDate) {
    throw new AppException(RELEASE_ERRORS.EFFECTIVE_BEFORE_BASE);
  }
}
