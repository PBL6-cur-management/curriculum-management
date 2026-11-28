import { Injectable } from '@nestjs/common';
import {
  ApprovalAction,
  NotificationType,
  type ChangeRequest,
  type Prisma,
} from '../../generated/prisma/client.js';
import { NotificationService } from '../notifications/notification.service.js';
import { todayDate } from '../time/today.js';
import { academicOfficeHolderIds } from './academic-office.js';
import { facultyLeadershipHolderIds } from './faculty-leadership.js';
import type { ClosingAction, DecisionAction } from './approval-recorder.js';
import { levelOfStatus } from './approval-rules.js';
import {
  APPROVAL_LEVEL,
  APPROVAL_LEVEL_NAMES,
  type ApprovalLevel,
} from './approval.constants.js';
import { NOTIFICATION_CONTENT } from './notification-content.js';

type NotifySubject = Pick<
  ChangeRequest,
  'id' | 'requestCode' | 'title' | 'createdById' | 'submissionRound'
>;

// Who hears about which event (D19). F-13's submit, F-14's decisions and F-15's release all go through here.
@Injectable()
export class RequestNotifier {
  constructor(private readonly notifications: NotificationService) {}

  // The approvers who now have to act: the level's PENDING rows, or every academic-office holder but the creator at level 3.
  async arrived(
    tx: Prisma.TransactionClient,
    request: NotifySubject,
    level: ApprovalLevel,
    actorId: string,
  ): Promise<void> {
    await this.send(
      tx,
      request,
      await this.approversAt(tx, request, level),
      NotificationType.REQUEST_AWAITING_YOU,
      NOTIFICATION_CONTENT.awaiting(request, APPROVAL_LEVEL_NAMES[level]),
      actorId,
    );
  }

  // The creator plus every named approver of the round who was not skipped (US-065 AC3).
  async decided(
    tx: Prisma.TransactionClient,
    request: NotifySubject,
    action: ClosingAction,
    remark: string,
    actorId: string,
    except: readonly string[] = [],
  ): Promise<void> {
    const actor = await actorName(tx, actorId);
    const rows = await tx.approvalStep.findMany({
      where: {
        changeRequestId: request.id,
        submissionRound: request.submissionRound,
        isSkipped: false,
        approverId: { not: null },
      },
      select: { approverId: true },
    });
    const approverIds = rows.flatMap((row) =>
      row.approverId ? [row.approverId] : [],
    );
    const recipientIds = [request.createdById, ...approverIds].filter(
      (id) => !except.includes(id),
    );
    const [type, content] =
      action === ApprovalAction.RETURN
        ? [
            NotificationType.REQUEST_RETURNED,
            NOTIFICATION_CONTENT.returned(request, actor, remark),
          ]
        : [
            NotificationType.REQUEST_REJECTED,
            NOTIFICATION_CONTENT.rejected(request, actor, remark),
          ];
    await this.send(tx, request, recipientIds, type, content, actorId);
  }

  async approved(
    tx: Prisma.TransactionClient,
    request: NotifySubject,
    actorId: string,
  ): Promise<void> {
    await this.send(
      tx,
      request,
      [request.createdById],
      NotificationType.REQUEST_APPROVED,
      NOTIFICATION_CONTENT.applied(request),
      actorId,
    );
  }

  // The request's changes are now in force (F-15): sent once, when its last version is Active, never with `approved`.
  async effective(
    tx: Prisma.TransactionClient,
    request: NotifySubject,
    semesterId: string,
    actorId: string,
  ): Promise<void> {
    const semester = await tx.semester.findUniqueOrThrow({
      where: { id: semesterId },
      select: { semesterCode: true },
    });
    await this.send(
      tx,
      request,
      [request.createdById],
      NotificationType.REQUEST_EFFECTIVE,
      NOTIFICATION_CONTENT.effective(request, semester.semesterCode),
      actorId,
    );
  }

  async overridden(
    tx: Prisma.TransactionClient,
    request: NotifySubject,
    bypassedIds: readonly string[],
    action: DecisionAction,
    reason: string,
    actorId: string,
  ): Promise<void> {
    const actor = await actorName(tx, actorId);
    await this.send(
      tx,
      request,
      bypassedIds,
      NotificationType.REQUEST_OVERRIDDEN,
      NOTIFICATION_CONTENT.overridden(request, actor, action, reason),
      actorId,
    );
  }

  // The creator plus whoever must act now; a closed request has no current approvers.
  async commented(
    tx: Prisma.TransactionClient,
    request: NotifySubject & Pick<ChangeRequest, 'status'>,
    actorId: string,
  ): Promise<void> {
    const level = levelOfStatus(request.status);
    const current =
      level === null ? [] : await this.approversAt(tx, request, level);
    const actor = await actorName(tx, actorId);
    await this.send(
      tx,
      request,
      [request.createdById, ...current],
      NotificationType.REQUEST_COMMENTED,
      NOTIFICATION_CONTENT.commented(request, actor),
      actorId,
    );
  }

  private async approversAt(
    tx: Prisma.TransactionClient,
    request: NotifySubject,
    level: ApprovalLevel,
  ): Promise<string[]> {
    if (level === APPROVAL_LEVEL.ACADEMIC_OFFICE) {
      return academicOfficeHolderIds(tx, request.createdById, todayDate());
    }
    if (level === APPROVAL_LEVEL.FACULTY_LEADERSHIP) {
      const rows = await tx.approvalStep.findMany({
        where: {
          changeRequestId: request.id,
          submissionRound: request.submissionRound,
          approvalLevel: level,
          action: ApprovalAction.PENDING,
          forFacultyId: { not: null },
        },
        select: { forFacultyId: true },
      });
      const facultyIds = [
        ...new Set(
          rows.flatMap((row) => (row.forFacultyId ? [row.forFacultyId] : [])),
        ),
      ];
      const today = todayDate();
      const ids = await Promise.all(
        facultyIds.map((facultyId) =>
          facultyLeadershipHolderIds(tx, facultyId, request.createdById, today),
        ),
      );
      return [...new Set(ids.flat())];
    }
    const rows = await tx.approvalStep.findMany({
      where: {
        changeRequestId: request.id,
        submissionRound: request.submissionRound,
        approvalLevel: level,
        action: ApprovalAction.PENDING,
        approverId: { not: null },
      },
      select: { approverId: true },
    });
    return rows.flatMap((row) => (row.approverId ? [row.approverId] : []));
  }

  private send(
    tx: Prisma.TransactionClient,
    request: NotifySubject,
    recipientIds: readonly string[],
    type: NotificationType,
    content: string,
    actorId: string,
  ): Promise<number> {
    return this.notifications.notify(tx, {
      recipientIds,
      type,
      content,
      changeRequestId: request.id,
      actorId,
    });
  }
}

async function actorName(
  tx: Prisma.TransactionClient,
  actorId: string,
): Promise<string> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: actorId },
    select: { fullName: true },
  });
  return user.fullName;
}
