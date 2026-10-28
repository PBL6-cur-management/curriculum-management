import { Injectable, Logger } from '@nestjs/common';
import {
  ApprovalAction,
  ChangeRequestStatus,
  ChangeRequestType,
  ProgramVersionStatus,
  type ChangeRequest,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { ApprovalRecorder } from '../../shared/change-requests/approval-recorder.js';
import { levelOfStatus } from '../../shared/change-requests/approval-rules.js';
import { APPROVAL_LEVEL } from '../../shared/change-requests/approval.constants.js';
import { APPROVAL_ERRORS } from '../../shared/change-requests/approval.errors.js';
import { RequestNotifier } from '../../shared/change-requests/request-notifier.js';
import { StaleChecker } from '../../shared/change-requests/stale-checker.js';
import { lockRequisiteGraph } from '../../shared/courses/requisite-graph.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { RELEASE_TRANSACTION } from '../../shared/releases/release-locks.js';
import { RELEASE_ERRORS } from '../../shared/releases/release.errors.js';
import { requireSemesterStart } from '../../shared/releases/semester-start.js';
import { fromIsoDay, todayDate } from '../../shared/time/today.js';
import { APPROVAL_FEATURE_ERRORS } from './approval-feature.errors.js';
import { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import { SUBMISSION_ERRORS } from './change-request-feature.errors.js';
import type { ChangeRequestDetailDto } from './change-request-response.dto.js';
import { FinalApprovalApplier } from './final-approval.applier.js';
import type {
  FinalApprovalPreviewDto,
  FinalApproveDto,
} from './final-approval.dto.js';
import { hasGradingChanges } from './grading-changes.js';
import { FinalApprovalPreviewReader } from './final-approval.preview.js';
import { findVisibleRequest } from './request-visibility.js';

const NOT_FINAL_TYPES: readonly ChangeRequestType[] = [
  ChangeRequestType.ORGANIZATION,
];

// MH-43 (US-072): level 3 of a data request. One transaction claims the request, re-checks that it is still current,
// applies it, records the decision and closes it — an approved request is never left unapplied (D10).
@Injectable()
export class FinalApprovalService {
  private readonly logger = new Logger(FinalApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: ApprovalRecorder,
    private readonly stale: StaleChecker,
    private readonly applier: FinalApprovalApplier,
    private readonly notifier: RequestNotifier,
    private readonly previews: FinalApprovalPreviewReader,
    private readonly details: ChangeRequestDetailReader,
  ) {}

  async preview(
    id: string,
    access: AccessContext,
  ): Promise<FinalApprovalPreviewDto> {
    const request = await this.finalLevelRequest(id, access);
    await this.actionableRows(this.prisma, request, access);
    return this.previews.read(request);
  }

  async approve(
    id: string,
    dto: FinalApproveDto,
    access: AccessContext,
  ): Promise<ChangeRequestDetailDto> {
    const visible = await this.finalLevelRequest(id, access);
    await this.prisma.$transaction(async (tx) => {
      await this.recorder.claim(tx, visible);
      const request = await tx.changeRequest.findUniqueOrThrow({
        where: { id },
      });
      const rows = await this.actionableRows(tx, request, access);
      if (await this.stale.isStale(tx, request)) {
        throw new AppException(SUBMISSION_ERRORS.STALE_BASE);
      }
      const semester = await requireSemesterStart(tx, dto.effectiveSemesterId);
      const today = todayDate();
      const pastUsed = this.assertSemesterAllowed(
        request,
        dto,
        semester.startDate,
        today,
        await hasGradingChanges(tx, request.id),
      );
      await lockRequisiteGraph(tx);
      const now = new Date();
      const released = await this.applier.apply(tx, request, {
        dto,
        semester,
        actorId: access.userId,
        now,
        today,
      });
      await this.recorder.record(
        tx,
        rows.map((row) => row.id),
        {
          action: ApprovalAction.APPROVE,
          remark: dto.remark ?? null,
          performedById: access.userId,
          isOverride: false,
        },
      );
      await tx.changeRequest.update({
        where: { id },
        data: {
          decisionNumber: dto.decisionNumber,
          signedDate: fromIsoDay(dto.signedDate),
          effectiveSemesterId: semester.id,
          pastSemesterAllowed: pastUsed,
        },
      });
      // Effective at once when no created version still waits for its semester (and always for catalog-only requests).
      const waiting = released.some(
        (version) => version.status === ProgramVersionStatus.PENDING,
      );
      await this.recorder.close(
        tx,
        id,
        waiting ? ChangeRequestStatus.APPROVED : ChangeRequestStatus.EFFECTIVE,
      );
      await this.notifier.approved(tx, request, access.userId);
      if (!waiting) {
        await this.notifier.effective(tx, request, semester.id, access.userId);
      }
      if (pastUsed) {
        this.logger.warn(
          `Change request ${request.requestCode} released into started semester ${semester.semesterCode}`,
        );
      }
    }, RELEASE_TRANSACTION);
    this.logger.log(
      `Change request ${id} finally approved by ${access.userId}`,
    );
    return this.details.read(id, access);
  }

  // A semester that has begun is for the academic office's own requests only, and only when it says so (F15-03);
  // a started semester is never taken silently, nor a future one marked as past. Grade formula changes have no
  // such exception: a class already running keeps its formula, whoever filed the request.
  private assertSemesterAllowed(
    request: ChangeRequest,
    dto: FinalApproveDto,
    startDate: Date,
    today: Date,
    changesGrading: boolean,
  ): boolean {
    if (startDate > today) return false;
    if (changesGrading) {
      throw new AppException(RELEASE_ERRORS.SEMESTER_ALREADY_STARTED);
    }
    if (dto.allowPastSemester && request.createdByAcademicOffice) return true;
    throw new AppException(RELEASE_ERRORS.SEMESTER_ALREADY_STARTED);
  }

  // The request exists for the caller, is a data request waiting at level 3 and was not made by the caller.
  private async finalLevelRequest(
    id: string,
    access: AccessContext,
  ): Promise<ChangeRequest> {
    const visible = await findVisibleRequest(this.prisma, id, access);
    if (NOT_FINAL_TYPES.includes(visible.requestType)) {
      throw new AppException(
        APPROVAL_FEATURE_ERRORS.FINAL_APPROVAL_NOT_APPLICABLE,
      );
    }
    if (visible.createdById === access.userId) {
      throw new AppException(APPROVAL_ERRORS.SELF_APPROVAL);
    }
    if (levelOfStatus(visible.status) !== APPROVAL_LEVEL.ACADEMIC_OFFICE) {
      throw new AppException(APPROVAL_ERRORS.NOT_YOUR_STEP);
    }
    return this.prisma.changeRequest.findUniqueOrThrow({ where: { id } });
  }

  private async actionableRows(
    db: Parameters<ApprovalRecorder['actionableRows']>[0],
    request: ChangeRequest,
    access: AccessContext,
  ) {
    const rows = await this.recorder.actionableRows(
      db,
      request,
      access.userId,
      todayDate(),
    );
    if (rows.length === 0)
      throw new AppException(APPROVAL_ERRORS.NOT_YOUR_STEP);
    return rows;
  }
}
