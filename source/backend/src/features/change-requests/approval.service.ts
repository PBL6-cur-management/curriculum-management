import { Injectable, Logger } from '@nestjs/common';
import {
  ApprovalAction,
  ChangeRequestStatus,
  ChangeRequestType,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import {
  ApprovalRecorder,
  type ActionableRow,
  type ClosingAction,
  type Decision,
} from '../../shared/change-requests/approval-recorder.js';
import { levelOfStatus } from '../../shared/change-requests/approval-rules.js';
import { APPROVAL_LEVEL } from '../../shared/change-requests/approval.constants.js';
import { APPROVAL_ERRORS } from '../../shared/change-requests/approval.errors.js';
import { RequestNotifier } from '../../shared/change-requests/request-notifier.js';
import { StaleChecker } from '../../shared/change-requests/stale-checker.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { todayDate } from '../../shared/time/today.js';
import { APPROVAL_FEATURE_ERRORS } from './approval-feature.errors.js';
import { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import { SUBMISSION_ERRORS } from './change-request-feature.errors.js';
import type { ChangeRequestDetailDto } from './change-request-response.dto.js';
import type {
  ApproveDecisionDto,
  DecisionRemarkDto,
  OverrideDecisionDto,
} from './decision.dto.js';
import { OrganizationalApplier } from './organizational-applier.js';
import { findVisibleRequest, type RequestCore } from './request-visibility.js';
import { WorkingCopyService } from './working-copy.service.js';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: ApprovalRecorder,
    private readonly stale: StaleChecker,
    private readonly applier: OrganizationalApplier,
    private readonly notifier: RequestNotifier,
    private readonly copies: WorkingCopyService,
    private readonly details: ChangeRequestDetailReader,
  ) {}

  async approve(
    id: string,
    dto: ApproveDecisionDto,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const request = await this.decidable(id, access);
    const finalLevel =
      levelOfStatus(request.status) === APPROVAL_LEVEL.ACADEMIC_OFFICE;
    // D5: a data request needs the decision number and semester of F-15's final approval.
    if (finalLevel && request.requestType !== ChangeRequestType.ORGANIZATION) {
      throw new AppException(APPROVAL_FEATURE_ERRORS.FINAL_APPROVAL_REQUIRED);
    }
    await this.prisma.$transaction(async (tx) => {
      const rows = await this.ownRows(tx, request, access);
      if (finalLevel) {
        if (await this.stale.isStale(tx, request)) {
          throw new AppException(SUBMISSION_ERRORS.STALE_BASE);
        }
        await this.applier.apply(tx, request, access.userId);
      }
      await this.recorder.recordRows(
        tx,
        rows,
        decision(ApprovalAction.APPROVE, dto.remark ?? null, access),
      );
      const result = await this.recorder.advance(tx, request);
      if (result.kind === 'NEXT_LEVEL') {
        await this.notifier.arrived(tx, request, result.level, access.userId);
      }
      if (result.kind === 'COMPLETE') {
        await this.recorder.close(
          tx,
          request.id,
          ChangeRequestStatus.EFFECTIVE,
        );
        await this.notifier.approved(tx, request, access.userId);
      }
    });
    this.logger.log(
      `Change request ${id} approved at ${request.status} by ${access.userId}`,
    );
    return this.details.read(id, access);
  }

  returnToDraft(
    id: string,
    dto: DecisionRemarkDto,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    return this.close(
      id,
      dto.remark,
      ApprovalAction.RETURN,
      ChangeRequestStatus.DRAFT,
      access,
    );
  }

  reject(
    id: string,
    dto: DecisionRemarkDto,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    return this.close(
      id,
      dto.remark,
      ApprovalAction.REJECT,
      ChangeRequestStatus.REJECTED,
      access,
    );
  }

  // US-070: R1 decides every PENDING row of a level 1 or 2 request on the approvers' behalf, with a reason.
  async override(
    id: string,
    dto: OverrideDecisionDto,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const request = await this.decidable(id, access);
    const level = levelOfStatus(request.status);
    if (
      level !== APPROVAL_LEVEL.COORDINATOR &&
      level !== APPROVAL_LEVEL.DIRECTOR
    ) {
      throw new AppException(APPROVAL_FEATURE_ERRORS.OVERRIDE_LEVEL);
    }
    await this.prisma.$transaction(async (tx) => {
      await this.recorder.claim(tx, request);
      const bypassed = await tx.approvalStep.findMany({
        where: {
          changeRequestId: id,
          submissionRound: request.submissionRound,
          approvalLevel: level,
          action: ApprovalAction.PENDING,
        },
      });
      await this.recorder.record(
        tx,
        bypassed.map((row) => row.id),
        {
          action: dto.action,
          remark: dto.reason,
          performedById: access.userId,
          isOverride: true,
        },
      );
      const bypassedIds = bypassed.flatMap((row) =>
        row.approverId ? [row.approverId] : [],
      );
      await this.notifier.overridden(
        tx,
        request,
        bypassedIds,
        dto.action,
        dto.reason,
        access.userId,
      );
      if (dto.action === ApprovalAction.APPROVE) {
        const result = await this.recorder.advance(tx, request);
        if (result.kind === 'NEXT_LEVEL') {
          await this.notifier.arrived(tx, request, result.level, access.userId);
        }
      } else {
        await this.closeRequest(
          tx,
          request,
          dto.action,
          dto.reason,
          access,
          bypassedIds,
        );
      }
    });
    this.logger.log(
      `Change request ${id} overridden (${dto.action}) at level ${level} by ${access.userId}`,
    );
    return this.details.read(id, access);
  }

  // Return and Reject end the round at once, whoever else at the level has not decided yet (US-064 AC3).
  private async close(
    id: string,
    remark: string,
    action: ClosingAction,
    status: ChangeRequestStatus,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const request = await this.decidable(id, access);
    await this.prisma.$transaction(async (tx) => {
      const rows = await this.ownRows(tx, request, access);
      await this.recorder.recordRows(
        tx,
        rows,
        decision(action, remark, access),
      );
      await this.closeRequest(tx, request, action, remark, access);
    });
    this.logger.log(
      `Change request ${id} ${action} at ${request.status} by ${access.userId} -> ${status}`,
    );
    return this.details.read(id, access);
  }

  // A Return reopens the Draft for editing; a Reject is final, so its working copy goes (BR-29).
  private async closeRequest(
    tx: Prisma.TransactionClient,
    request: RequestCore,
    action: ClosingAction,
    remark: string,
    access: AccessContext,
    except: readonly string[] = [],
  ): Promise<void> {
    const rejected = action === ApprovalAction.REJECT;
    await this.recorder.close(
      tx,
      request.id,
      rejected ? ChangeRequestStatus.REJECTED : ChangeRequestStatus.DRAFT,
    );
    if (rejected) await this.copies.discard(tx, request.id);
    await this.notifier.decided(
      tx,
      request,
      action,
      remark,
      access.userId,
      except,
    );
  }

  private async decidable(
    id: string,
    access: AccessContext,
  ): Promise<RequestCore> {
    const request = await findVisibleRequest(this.prisma, id, access);
    if (request.createdById === access.userId) {
      throw new AppException(APPROVAL_ERRORS.SELF_APPROVAL);
    }
    return request;
  }

  private async ownRows(
    tx: Prisma.TransactionClient,
    request: RequestCore,
    access: AccessContext,
  ): Promise<ActionableRow[]> {
    await this.recorder.claim(tx, request);
    const rows = await this.recorder.actionableRows(
      tx,
      request,
      access.userId,
      todayDate(),
    );
    if (rows.length === 0)
      throw new AppException(APPROVAL_ERRORS.NOT_YOUR_STEP);
    return rows;
  }
}

function decision(
  action: Decision['action'],
  remark: string | null,
  access: AccessContext,
): Decision {
  return { action, remark, performedById: access.userId, isOverride: false };
}
