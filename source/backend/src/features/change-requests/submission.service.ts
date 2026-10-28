import { Injectable, Logger } from '@nestjs/common';
import {
  ApprovalAction,
  ChangeRequestStatus,
  ChangeRequestType,
  ChangeTargetType,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import {
  PENDING_STATUS_BY_LEVEL,
  PENDING_STATUSES,
  type ApprovalLevel,
} from '../../shared/change-requests/approval.constants.js';
import { levelOfStatus } from '../../shared/change-requests/approval-rules.js';
import { RequestNotifier } from '../../shared/change-requests/request-notifier.js';
import { REQUEST_DRAFT_ERRORS } from '../../shared/change-requests/change-request.errors.js';
import { toJsonInput } from '../../shared/change-requests/diff/snapshot-entry.js';
import {
  WORKSPACE_KIND,
  workspaceKindFor,
} from '../../shared/change-requests/request-kinds.js';
import { StaleChecker } from '../../shared/change-requests/stale-checker.js';
import { lockRequisiteGraph } from '../../shared/courses/requisite-graph.js';
import { ConsistencyChecker } from '../../shared/curriculum/consistency-checker.js';
import { WARNING_SEVERITY } from '../../shared/curriculum/curriculum-warnings.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { todayDate } from '../../shared/time/today.js';
import { ASSESSMENT_ERRORS } from '../../shared/syllabi/grade-formula.errors.js';
import { assessmentBlockers } from './assessment-blockers.js';
import { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import { SUBMISSION_ERRORS } from './change-request-feature.errors.js';
import type { ChangeRequestDetailDto } from './change-request-response.dto.js';
import { ChangeRequestsService } from './change-requests.service.js';
import { RequestItemsService } from './request-items.service.js';
import {
  RoutingPlanner,
  type PlannedStep,
  type RoutingPlan,
  type RoutingSubject,
} from './routing-planner.js';
import {
  toSubmitPreviewDto,
  type BlockingIssueDto,
  type SubmitPreviewDto,
} from './submit-preview.dto.js';
import { findVisibleRequest, type RequestCore } from './request-visibility.js';
import { WorkingCopyService } from './working-copy.service.js';
import { CONSISTENCY_ERRORS } from '../../shared/curriculum/consistency-errors.js';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requests: ChangeRequestsService,
    private readonly items: RequestItemsService,
    private readonly stale: StaleChecker,
    private readonly checker: ConsistencyChecker,
    private readonly routing: RoutingPlanner,
    private readonly details: ChangeRequestDetailReader,
    private readonly notifier: RequestNotifier,
    private readonly copies: WorkingCopyService,
  ) {}

  // A dry run of submit: the same checks and the same routing, reported instead of thrown (US-057 AC7).
  async preview(id: string, access: AccessContext): Promise<SubmitPreviewDto> {
    const request = await this.requests.findOwnDraft(id, access);
    const issues: BlockingIssueDto[] = [];
    const { items } = await this.items.current(this.prisma, request);
    if (items.length === 0) issues.push(issue(SUBMISSION_ERRORS.NO_CHANGES));
    if (await this.stale.isStale(this.prisma, request)) {
      issues.push(issue(SUBMISSION_ERRORS.STALE_BASE));
    }
    const copyId = await programCopyId(this.prisma, request);
    if (copyId) {
      const { issues: found } = await this.checker.check(copyId);
      issues.push(
        ...found
          .filter((found) => found.severity === WARNING_SEVERITY.ERROR)
          .map((found) => ({
            code: CONSISTENCY_ERRORS.CONSISTENCY_FAILED.code,
            message: found.message,
          })),
      );
    }
    issues.push(...(await assessmentBlockers(this.prisma, request, false)));
    let plan: RoutingPlan = { steps: [], affectedPrograms: [] };
    try {
      plan = await this.routing.plan(
        this.prisma,
        await routingSubject(this.prisma, request),
        items,
        todayDate(),
      );
    } catch (error) {
      // Only business refusals are reported; anything else is a bug and propagates.
      if (!(error instanceof AppException)) throw error;
      issues.push({ code: error.code, message: error.message });
    }
    return toSubmitPreviewDto(items.length, plan, issues);
  }

  async submit(
    id: string,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const request = await this.requests.findOwnDraft(id, access);
    const round = request.submissionRound + 1;
    await this.prisma.$transaction(async (tx) => {
      // The round is claimed first so two submits cannot both pass; everything after runs under that claim.
      const { count } = await tx.changeRequest.updateMany({
        where: {
          id,
          status: ChangeRequestStatus.DRAFT,
          submissionRound: request.submissionRound,
        },
        data: { submissionRound: round },
      });
      if (count === 0) {
        throw new AppException(REQUEST_DRAFT_ERRORS.NOT_DRAFT);
      }
      const copyId = await programCopyId(tx, request);
      if (copyId) {
        // F-08: a framework with errors cannot be submitted; the lock keeps a catalog edge from landing between check and write.
        await lockRequisiteGraph(tx);
        await this.checker.assertPasses(copyId, tx);
      }
      const blockers = await assessmentBlockers(tx, request, true);
      if (blockers.length > 0) {
        throw new AppException(
          ASSESSMENT_ERRORS.NOT_READY,
          blockers.map((blocker) => ({
            field: blocker.code,
            constraints: [blocker.message],
          })),
        );
      }
      if (await this.stale.isStale(tx, request)) {
        throw new AppException(SUBMISSION_ERRORS.STALE_BASE);
      }
      const { live, items } = await this.items.current(tx, request);
      if (items.length === 0) {
        throw new AppException(SUBMISSION_ERRORS.NO_CHANGES);
      }
      if (live) {
        await tx.changeItem.deleteMany({ where: { changeRequestId: id } });
        await tx.changeItem.createMany({
          data: items.map((item) => ({
            changeRequestId: id,
            sortOrder: item.sortOrder,
            entityType: item.entityType,
            itemKey: item.itemKey,
            label: item.label,
            recordId: item.recordId,
            oldValue: toJsonInput(item.oldValue),
            newValue: toJsonInput(item.newValue),
            baseVersion: item.baseVersion,
          })),
        });
      }
      await tx.changeRequestDocument.updateMany({
        where: { changeRequestId: id, seenInRound: null },
        data: { seenInRound: round },
      });
      const plan = await this.routing.plan(
        tx,
        await routingSubject(tx, request),
        items,
        todayDate(),
      );
      const now = new Date();
      await tx.approvalStep.createMany({
        data: plan.steps.map((step) => ({
          changeRequestId: id,
          submissionRound: round,
          approvalLevel: step.approvalLevel,
          approverId: step.approverId,
          forSubjectGroupId: step.forSubjectGroupId,
          forProgramId: step.forProgramId,
          isSkipped: step.isSkipped,
          skipReason: step.skipReason,
          // Skipped rows are settled at submit; only PENDING rows wait for someone (US-059 AC3 reads isSkipped).
          action: step.isSkipped
            ? ApprovalAction.APPROVE
            : ApprovalAction.PENDING,
          recordedAt: step.isSkipped ? now : null,
        })),
      });
      const status = firstPendingStatus(plan.steps);
      await tx.changeRequest.update({
        where: { id },
        data: { status, levelEnteredAt: now },
      });
      await this.notifier.arrived(
        tx,
        { ...request, submissionRound: round },
        levelOfStatus(status)!,
        access.userId,
      );
    });
    this.logger.log(
      `Change request ${id} submitted (round ${round}) by ${access.userId}`,
    );
    return this.details.read(id, access);
  }

  // US-059: allowed while nobody has approved in this round; skipped rows never count as approvals.
  async withdraw(
    id: string,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const request = await findVisibleRequest(this.prisma, id, access);
    if (request.createdById !== access.userId) {
      throw new AppException(REQUEST_DRAFT_ERRORS.NOT_CREATOR);
    }
    const withdrawable =
      PENDING_STATUSES.includes(request.status) ||
      (request.status === ChangeRequestStatus.DRAFT &&
        request.submissionRound > 0);
    if (!withdrawable) {
      throw new AppException(SUBMISSION_ERRORS.WITHDRAW_NOT_ALLOWED);
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.changeRequest.updateMany({
        where: {
          id,
          status: request.status,
          submissionRound: request.submissionRound,
          steps: {
            none: {
              submissionRound: request.submissionRound,
              action: ApprovalAction.APPROVE,
              isSkipped: false,
            },
          },
        },
        data: { status: ChangeRequestStatus.WITHDRAWN, levelEnteredAt: null },
      });
      if (count === 0) {
        throw new AppException(SUBMISSION_ERRORS.WITHDRAW_NOT_ALLOWED);
      }
      // A withdrawn request is final (BR-29): its working copy goes with it. The stored items keep the diff readable.
      await this.copies.discard(tx, id);
    });
    this.logger.log(`Change request ${id} withdrawn by ${access.userId}`);
    return this.details.read(id, access);
  }
}

function issue(definition: {
  code: string;
  message: string;
}): BlockingIssueDto {
  return { code: definition.code, message: definition.message };
}

// The lowest level that still has someone to wait for; level 3 is never skipped, so one always exists.
function firstPendingStatus(
  steps: readonly PlannedStep[],
): ChangeRequestStatus {
  const level = Math.min(
    ...steps
      .filter((step) => !step.isSkipped)
      .map((step) => step.approvalLevel),
  ) as ApprovalLevel;
  return PENDING_STATUS_BY_LEVEL[level];
}

async function programCopyId(
  db: Db,
  request: RequestCore,
): Promise<string | null> {
  if (
    workspaceKindFor(request.requestType, request.targetType) !==
    WORKSPACE_KIND.PROGRAM_VERSION
  ) {
    return null;
  }
  const copy = await db.programVersion.findUnique({
    where: { sourceRequestId: request.id },
    select: { id: true },
  });
  return copy?.id ?? null;
}

async function routingSubject(
  db: Db,
  request: RequestCore,
): Promise<RoutingSubject> {
  const course =
    request.targetType === ChangeTargetType.COURSE && request.courseId
      ? await db.course.findUniqueOrThrow({
          where: { id: request.courseId },
          select: {
            id: true,
            ownerGroupId: true,
            ownerFaculty: { select: { unitCode: true } },
          },
        })
      : null;
  return {
    requestType: request.requestType as ChangeRequestType,
    createdById: request.createdById,
    courseId: request.courseId,
    programId: request.programId,
    course: course && {
      id: course.id,
      ownerGroupId: course.ownerGroupId,
      ownerFacultyCode: course.ownerFaculty.unitCode,
    },
  };
}
