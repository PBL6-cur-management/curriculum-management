import { Injectable } from '@nestjs/common';
import { ApprovalAction, type Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type {
  ChangeRequestStatisticsDto,
  CountDto,
  StatisticsQueryDto,
} from './dto/reports.dto.js';
import { REPORT_ERRORS } from './reports.errors.js';

const MS_PER_HOUR = 3_600_000;
const DAY_MS = 86_400_000;

interface StepFact {
  submissionRound: number;
  approvalLevel: number;
  action: ApprovalAction;
  isSkipped: boolean;
  recordedAt: Date | null;
  createdAt: Date;
}

// One visit = a level that actually decided in one submission round. It starts when the round was submitted
// (level 1) or when the previous deciding level finished, and ends at the deciding record: the first return/reject,
// else the last approval. Skipped and still-pending levels are not visits; updatedAt is never a completion time.
export function levelVisits(
  steps: readonly StepFact[],
): { approvalLevel: number; hours: number }[] {
  const rounds = new Map<number, StepFact[]>();
  for (const step of steps)
    rounds.set(step.submissionRound, [
      ...(rounds.get(step.submissionRound) ?? []),
      step,
    ]);
  const visits: { approvalLevel: number; hours: number }[] = [];
  for (const roundSteps of rounds.values()) {
    let entry = new Date(
      Math.min(...roundSteps.map((step) => step.createdAt.getTime())),
    );
    const levels = [
      ...new Set(roundSteps.map((step) => step.approvalLevel)),
    ].sort((a, b) => a - b);
    for (const level of levels) {
      const decided = roundSteps.filter(
        (step) =>
          step.approvalLevel === level &&
          !step.isSkipped &&
          step.action !== ApprovalAction.PENDING &&
          step.recordedAt !== null,
      );
      if (!decided.length) continue;
      const stopping = decided.filter(
        (step) => step.action !== ApprovalAction.APPROVE,
      );
      const pendingLeft = roundSteps.some(
        (step) =>
          step.approvalLevel === level &&
          !step.isSkipped &&
          step.action === ApprovalAction.PENDING,
      );
      // Parallel approvers still deciding: the level has not finished yet.
      if (!stopping.length && pendingLeft) break;
      const exit = stopping.length
        ? Math.min(...stopping.map((step) => step.recordedAt!.getTime()))
        : Math.max(...decided.map((step) => step.recordedAt!.getTime()));
      visits.push({
        approvalLevel: level,
        hours: Math.max(0, exit - entry.getTime()) / MS_PER_HOUR,
      });
      if (stopping.length) break;
      entry = new Date(exit);
    }
  }
  return visits;
}

function counts(values: string[]): CountDto[] {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

@Injectable()
export class ChangeRequestStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    access: AccessContext,
    query: StatisticsQueryDto,
  ): Promise<ChangeRequestStatisticsDto> {
    const from = new Date(query.from.slice(0, 10));
    const to = new Date(new Date(query.to.slice(0, 10)).getTime() + DAY_MS);
    if (!(from < to)) throw new AppException(REPORT_ERRORS.INTERVAL_INVALID);
    const scope = access.scopeFor(PERMISSIONS.CHANGE_REQUEST_STATISTICS);
    const scoped: Prisma.ChangeRequestWhereInput = scope.all
      ? {}
      : {
          OR: [
            { programId: { in: [...scope.programIds] } },
            { subjectGroupId: { in: [...scope.subjectGroupIds] } },
            { program: { facultyId: { in: [...scope.orgUnitIds] } } },
            { subjectGroup: { facultyId: { in: [...scope.orgUnitIds] } } },
          ],
        };
    const rows = await this.prisma.changeRequest.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        ...(query.programId ? { programId: query.programId } : {}),
        ...scoped,
      },
      select: {
        status: true,
        requestType: true,
        origin: true,
        steps: {
          select: {
            submissionRound: true,
            approvalLevel: true,
            action: true,
            isSkipped: true,
            recordedAt: true,
            createdAt: true,
          },
        },
      },
    });
    const byLevel = new Map<number, number[]>();
    for (const row of rows)
      for (const visit of levelVisits(row.steps))
        byLevel.set(visit.approvalLevel, [
          ...(byLevel.get(visit.approvalLevel) ?? []),
          visit.hours,
        ]);
    return {
      total: rows.length,
      byStatus: counts(rows.map((row) => row.status)),
      byType: counts(rows.map((row) => row.requestType)),
      byOrigin: counts(rows.map((row) => row.origin)),
      levels: [1, 2, 3].map((level) => {
        const hours = byLevel.get(level) ?? [];
        return {
          approvalLevel: level,
          visitCount: hours.length,
          averageHours: hours.length
            ? Math.round(
                (hours.reduce((a, b) => a + b, 0) / hours.length) * 10,
              ) / 10
            : null,
        };
      }),
      scoped: !scope.all,
    };
  }
}
