import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalAction,
  ApprovalDelegationStatus,
  ChangeRequestStatus,
  NotificationType,
  UserStatus,
} from '../../generated/prisma/client.js';
import { academicOfficeHolderIds } from '../../shared/change-requests/academic-office.js';
import {
  APPROVAL_LEVEL,
  APPROVAL_LEVEL_NAMES,
  type ApprovalLevel,
} from '../../shared/change-requests/approval.constants.js';
import { levelOfStatus } from '../../shared/change-requests/approval-rules.js';
import type { Env } from '../../shared/config/env.validation.js';
import { NotificationService } from '../../shared/notifications/notification.service.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { daysSince } from '../../shared/time/days-since.js';
import { todayDate } from '../../shared/time/today.js';
import { reminderCycle } from './reminder-rules.js';

const PENDING = [
  ChangeRequestStatus.PENDING_COORDINATOR,
  ChangeRequestStatus.PENDING_DIRECTOR,
  ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
];

export interface MaintenanceResult {
  expired: number;
  revoked: number;
  reminders: number;
}

// The nightly pass (and one at start-up) of F-25: grants past their last day become EXPIRED, grants whose
// accounts were disabled become REVOKED, and overdue requests remind whoever must act now. Every step reads the
// database, so a repeated or missed run changes nothing beyond what is due today.
@Injectable()
export class ApprovalMaintenanceService {
  private readonly logger = new Logger(ApprovalMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async run(today: Date = todayDate()): Promise<MaintenanceResult> {
    const expired = await this.prisma.approvalDelegation.updateMany({
      where: {
        status: ApprovalDelegationStatus.ACTIVE,
        validTo: { lt: today },
      },
      data: { status: ApprovalDelegationStatus.EXPIRED },
    });
    // US-114 AC6: authority already stops at read time; this records why the grant ended.
    const revoked = await this.prisma.approvalDelegation.updateMany({
      where: {
        status: ApprovalDelegationStatus.ACTIVE,
        OR: [
          { delegator: { status: { not: UserStatus.ACTIVE } } },
          { delegate: { status: { not: UserStatus.ACTIVE } } },
        ],
      },
      data: {
        status: ApprovalDelegationStatus.REVOKED,
        revokedAt: new Date(),
        revokeReason: 'Tài khoản đã bị vô hiệu hóa',
      },
    });
    const reminders =
      this.config.get('REMINDERS_ENABLED', { infer: true }) === 'true'
        ? await this.remind(today)
        : 0;
    const result = {
      expired: expired.count,
      revoked: revoked.count,
      reminders,
    };
    this.logger.log(
      `Approval maintenance: ${result.expired} expired, ${result.revoked} revoked, ${result.reminders} reminders`,
    );
    return result;
  }

  // US-116: one reminder per recipient per cycle, deduplicated by the dispatch ledger's unique key.
  async remind(today: Date): Promise<number> {
    const maxDays = this.config.get('REMINDER_MAX_DAYS', { infer: true });
    const repeatDays = this.config.get('REMINDER_REPEAT_DAYS', { infer: true });
    const requests = await this.prisma.changeRequest.findMany({
      where: { status: { in: PENDING }, levelEnteredAt: { not: null } },
      select: {
        id: true,
        requestCode: true,
        status: true,
        submissionRound: true,
        levelEnteredAt: true,
        createdById: true,
      },
    });
    let sent = 0;
    for (const request of requests) {
      const days = daysSince(request.levelEnteredAt!, today);
      const cycle = reminderCycle(days, maxDays, repeatDays);
      if (cycle === null) continue;
      const level = levelOfStatus(request.status)!;
      const recipients = await this.recipients(request, level, cycle, today);
      if (recipients.length === 0) continue;
      sent += await this.prisma.$transaction(async (tx) => {
        const fresh = await tx.approvalReminderDispatch.createManyAndReturn({
          data: recipients.map((recipientId) => ({
            changeRequestId: request.id,
            submissionRound: request.submissionRound,
            approvalLevel: level,
            levelEnteredAt: request.levelEnteredAt!,
            cycleIndex: cycle,
            recipientId,
          })),
          skipDuplicates: true,
          select: { recipientId: true },
        });
        if (fresh.length === 0) return 0;
        return this.notifications.notify(tx, {
          recipientIds: fresh.map((row) => row.recipientId),
          type: NotificationType.REQUEST_DEADLINE_REMINDER,
          content: `Đề xuất ${request.requestCode} đã chờ ở cấp ${APPROVAL_LEVEL_NAMES[level]} ${days} ngày, quá hạn ${maxDays} ngày.${cycle > 0 ? ' Đây là nhắc lại.' : ''}`,
          changeRequestId: request.id,
          actorId: null,
        });
      });
    }
    return sent;
  }

  // Whoever can act now: the pending named approvers and their usable delegates, or the academic office at
  // level 3. From the second cycle on, the academic office (R1) is told as well (US-116 AC2). Never the creator.
  private async recipients(
    request: {
      id: string;
      submissionRound: number;
      createdById: string;
    },
    level: ApprovalLevel,
    cycle: number,
    today: Date,
  ): Promise<string[]> {
    const ids = new Set<string>();
    const office = await academicOfficeHolderIds(
      this.prisma,
      request.createdById,
      today,
    );
    if (level === APPROVAL_LEVEL.ACADEMIC_OFFICE) {
      office.forEach((id) => ids.add(id));
    } else {
      const rows = await this.prisma.approvalStep.findMany({
        where: {
          changeRequestId: request.id,
          submissionRound: request.submissionRound,
          approvalLevel: level,
          action: ApprovalAction.PENDING,
          approver: { status: UserStatus.ACTIVE },
        },
        select: { approverId: true },
      });
      const approvers = rows.flatMap((row) =>
        row.approverId ? [row.approverId] : [],
      );
      approvers.forEach((id) => ids.add(id));
      const grants = await this.prisma.approvalDelegation.findMany({
        where: {
          delegatorId: { in: approvers },
          status: ApprovalDelegationStatus.ACTIVE,
          validFrom: { lte: today },
          validTo: { gte: today },
          OR: [{ scopeLevel: null }, { scopeLevel: level }],
          delegator: { status: UserStatus.ACTIVE },
          delegate: { status: UserStatus.ACTIVE },
        },
        select: { delegateId: true },
      });
      grants.forEach((grant) => ids.add(grant.delegateId));
      if (cycle > 0) office.forEach((id) => ids.add(id));
    }
    ids.delete(request.createdById);
    return [...ids].sort();
  }
}
