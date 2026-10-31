import { Injectable, Logger } from '@nestjs/common';
import {
  ApprovalDelegationStatus,
  NotificationType,
  SubjectGroupMemberRole,
  UserStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { isAcademicOfficeHolder } from '../../shared/change-requests/academic-office.js';
import {
  APPROVAL_LEVEL_NAMES,
  type ApprovalLevel,
} from '../../shared/change-requests/approval.constants.js';
import { usableGrants } from '../../shared/change-requests/delegation-authority.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { NotificationService } from '../../shared/notifications/notification.service.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { fromIsoDay, todayDate, toIsoDay } from '../../shared/time/today.js';
import { activeDirectorWhere } from '../../shared/programs/active-director.js';
import { activeMembershipWhere } from '../../shared/subject-groups/active-membership.js';
import { DELEGATION_ERRORS } from './delegation.errors.js';
import {
  DELEGABLE_LEVELS,
  type CreateDelegationDto,
  type DelegationAccessDto,
  type DelegationDto,
  type DelegationLevelDto,
  type DelegationQueryDto,
  type DelegationUserOptionDto,
} from './delegation.dto.js';

const USER_OPTION_SELECT = {
  id: true,
  userCode: true,
  fullName: true,
} as const;
const OPTION_LIMIT = 20;

const DELEGATION_INCLUDE = {
  delegator: { select: { ...USER_OPTION_SELECT, status: true } },
  delegate: { select: { ...USER_OPTION_SELECT, status: true } },
  createdBy: { select: USER_OPTION_SELECT },
} as const satisfies Prisma.ApprovalDelegationInclude;
type DelegationRow = Prisma.ApprovalDelegationGetPayload<{
  include: typeof DELEGATION_INCLUDE;
}>;

const levelDto = (level: number): DelegationLevelDto => ({
  approvalLevel: level,
  levelName: APPROVAL_LEVEL_NAMES[level as ApprovalLevel],
});

// MH-14 (US-114): dated grants to decide someone's named level-1/2 rows. A grant never copies a role; R3/R4
// delegate their own levels, R1 manages on behalf of any current named approver. There is no edit: revoke and
// create a new one, so every decision keeps the exact grant it was made under.
@Injectable()
export class ApprovalDelegationsService {
  private readonly logger = new Logger(ApprovalDelegationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async access(access: AccessContext): Promise<DelegationAccessDto> {
    const today = todayDate();
    const [isOffice, held, incoming] = await Promise.all([
      isAcademicOfficeHolder(this.prisma, access.userId, today),
      this.heldLevels(access.userId, today),
      usableGrants(this.prisma, access.userId, today),
    ]);
    const mayManage = access.has(PERMISSIONS.DELEGATION_MANAGE);
    return {
      canManage: mayManage && (isOffice || held.length > 0),
      canManageOthers: mayManage && isOffice,
      hasIncomingDelegation: incoming.length > 0,
    };
  }

  // R1 sees every grant; anyone else sees the grants they gave and received.
  async list(
    access: AccessContext,
    query: DelegationQueryDto,
  ): Promise<Page<DelegationDto>> {
    const today = todayDate();
    const isOffice = await this.isManagerOfOthers(access, today);
    const mine: Prisma.ApprovalDelegationWhereInput =
      query.direction === 'OUTGOING'
        ? { delegatorId: access.userId }
        : query.direction === 'INCOMING'
          ? { delegateId: access.userId }
          : isOffice
            ? {}
            : {
                OR: [
                  { delegatorId: access.userId },
                  { delegateId: access.userId },
                ],
              };
    const where: Prisma.ApprovalDelegationWhereInput = {
      AND: [mine, statusWhere(query.status, today)],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.approvalDelegation.findMany({
        where,
        include: DELEGATION_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.approvalDelegation.count({ where }),
    ]);
    return toPage(
      rows.map((row) => this.toDto(row, access, isOffice, today)),
      total,
      query,
    );
  }

  async create(
    access: AccessContext,
    dto: CreateDelegationDto,
  ): Promise<DelegationDto> {
    const today = todayDate();
    const isOffice = await this.isManagerOfOthers(access, today);
    const delegatorId = dto.delegatorId ?? access.userId;
    if (delegatorId !== access.userId && !isOffice) {
      throw new AppException(DELEGATION_ERRORS.OUT_OF_SCOPE);
    }
    if (dto.delegateId === delegatorId) {
      throw new AppException(DELEGATION_ERRORS.SELF);
    }
    const validFrom = fromIsoDay(dto.validFrom.slice(0, 10));
    const validTo = fromIsoDay(dto.validTo.slice(0, 10));
    if (validTo < validFrom) {
      throw new AppException(DELEGATION_ERRORS.INVALID_RANGE);
    }
    if (validTo < today) throw new AppException(DELEGATION_ERRORS.PAST_RANGE);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [delegatorId, dto.delegateId] } },
      select: { id: true, status: true },
    });
    if (
      users.length !== 2 ||
      users.some((user) => user.status !== UserStatus.ACTIVE)
    ) {
      throw new AppException(DELEGATION_ERRORS.ACCOUNT_INACTIVE);
    }
    const held = await this.heldLevels(delegatorId, today);
    const scopeLevel = dto.scopeLevel ?? null;
    if (
      held.length === 0 ||
      (scopeLevel !== null && !held.includes(scopeLevel))
    ) {
      throw new AppException(DELEGATION_ERRORS.SCOPE_UNAVAILABLE);
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.approvalDelegation.create({
        data: {
          delegatorId,
          delegateId: dto.delegateId,
          scopeLevel,
          validFrom,
          validTo,
          createdById: access.userId,
        },
        include: DELEGATION_INCLUDE,
      });
      const levels = scopeLevel === null ? held : [scopeLevel];
      await this.notifications.notify(tx, {
        recipientIds: [dto.delegateId],
        type: NotificationType.DELEGATION_RECEIVED,
        content: `${created.delegator.fullName} ủy quyền cho bạn duyệt thay cấp ${levels
          .map((level) => APPROVAL_LEVEL_NAMES[level as ApprovalLevel])
          .join(', ')} từ ${toVnDay(validFrom)} đến ${toVnDay(validTo)}.`,
        changeRequestId: null,
        actorId: access.userId,
      });
      return created;
    });
    this.logger.log(
      `Delegation ${row.id} ${delegatorId} -> ${dto.delegateId} created by ${access.userId}`,
    );
    return this.toDto(row, access, isOffice, today);
  }

  // Idempotent: a revoked grant stays revoked, an expired one stays expired (US-114 AC4).
  async revoke(
    access: AccessContext,
    id: string,
    reason: string | undefined,
  ): Promise<DelegationDto> {
    const today = todayDate();
    const isOffice = await this.isManagerOfOthers(access, today);
    const row = await this.prisma.approvalDelegation.findUnique({
      where: { id },
      include: DELEGATION_INCLUDE,
    });
    const visible =
      row &&
      (isOffice ||
        row.delegatorId === access.userId ||
        row.delegateId === access.userId);
    if (!visible) throw new AppException(DELEGATION_ERRORS.NOT_FOUND);
    if (!isOffice && row.delegatorId !== access.userId) {
      throw new AppException(DELEGATION_ERRORS.OUT_OF_SCOPE);
    }
    if (derivedStatus(row, today) !== ApprovalDelegationStatus.ACTIVE) {
      return this.toDto(row, access, isOffice, today);
    }
    await this.prisma.approvalDelegation.updateMany({
      where: { id, status: ApprovalDelegationStatus.ACTIVE },
      data: {
        status: ApprovalDelegationStatus.REVOKED,
        revokedAt: new Date(),
        revokedById: access.userId,
        revokeReason: reason?.trim() || null,
      },
    });
    this.logger.log(`Delegation ${id} revoked by ${access.userId}`);
    const updated = await this.prisma.approvalDelegation.findUniqueOrThrow({
      where: { id },
      include: DELEGATION_INCLUDE,
    });
    return this.toDto(updated, access, isOffice, today);
  }

  // Any active account other than the caller may receive a grant (UQ-01); it gains no role.
  recipients(
    access: AccessContext,
    q: string | undefined,
  ): Promise<DelegationUserOptionDto[]> {
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        id: { not: access.userId },
        ...searchWhere(q),
      },
      select: USER_OPTION_SELECT,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: OPTION_LIMIT,
    });
  }

  // R1 only: the people who hold a named approval level today.
  async delegators(
    access: AccessContext,
    q: string | undefined,
  ): Promise<DelegationUserOptionDto[]> {
    const today = todayDate();
    if (!(await this.isManagerOfOthers(access, today))) {
      throw new AppException(DELEGATION_ERRORS.OUT_OF_SCOPE);
    }
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        ...searchWhere(q),
        OR: [
          {
            subjectGroupMemberships: {
              some: {
                memberRole: SubjectGroupMemberRole.COORDINATOR,
                ...activeMembershipWhere(today),
              },
            },
          },
          { programDirectorships: { some: activeDirectorWhere(today) } },
        ],
      },
      select: USER_OPTION_SELECT,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: OPTION_LIMIT,
    });
  }

  async levels(
    access: AccessContext,
    delegatorId: string | undefined,
  ): Promise<DelegationLevelDto[]> {
    const today = todayDate();
    const target = delegatorId ?? access.userId;
    if (
      target !== access.userId &&
      !(await this.isManagerOfOthers(access, today))
    ) {
      throw new AppException(DELEGATION_ERRORS.OUT_OF_SCOPE);
    }
    return (await this.heldLevels(target, today)).map(levelDto);
  }

  // The levels a person is a named approver of today, from the same sources the routing planner uses:
  // coordinator of a subject group (level 1), director of an active program (level 2).
  private async heldLevels(userId: string, today: Date): Promise<number[]> {
    const [coordinator, director] = await Promise.all([
      this.prisma.subjectGroupMember.findFirst({
        where: {
          lecturerId: userId,
          memberRole: SubjectGroupMemberRole.COORDINATOR,
          lecturer: { status: UserStatus.ACTIVE },
          ...activeMembershipWhere(today),
        },
        select: { id: true },
      }),
      this.prisma.programDirectorAssignment.findFirst({
        where: {
          directorId: userId,
          director: { status: UserStatus.ACTIVE },
          ...activeDirectorWhere(today),
        },
        select: { id: true },
      }),
    ]);
    return DELEGABLE_LEVELS.filter((level) =>
      level === 1 ? coordinator !== null : director !== null,
    );
  }

  private async isManagerOfOthers(
    access: AccessContext,
    today: Date,
  ): Promise<boolean> {
    return (
      access.has(PERMISSIONS.DELEGATION_MANAGE) &&
      isAcademicOfficeHolder(this.prisma, access.userId, today)
    );
  }

  private toDto(
    row: DelegationRow,
    access: AccessContext,
    isOffice: boolean,
    today: Date,
  ): DelegationDto {
    const status = derivedStatus(row, today);
    return {
      id: row.id,
      delegator: option(row.delegator),
      delegate: option(row.delegate),
      scope: row.scopeLevel === null ? null : levelDto(row.scopeLevel),
      validFrom: toIsoDay(row.validFrom),
      validTo: toIsoDay(row.validTo),
      status,
      isEffectiveNow:
        status === ApprovalDelegationStatus.ACTIVE &&
        row.validFrom <= today &&
        row.delegator.status === UserStatus.ACTIVE &&
        row.delegate.status === UserStatus.ACTIVE,
      createdAt: row.createdAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      canRevoke:
        status === ApprovalDelegationStatus.ACTIVE &&
        access.has(PERMISSIONS.DELEGATION_MANAGE) &&
        (isOffice || row.delegatorId === access.userId),
    };
  }
}

// The stored state, with an ACTIVE grant past its last day shown as expired even before the nightly job runs.
export function derivedStatus(
  row: { status: ApprovalDelegationStatus; validTo: Date },
  today: Date,
): ApprovalDelegationStatus {
  if (row.status === ApprovalDelegationStatus.ACTIVE && row.validTo < today) {
    return ApprovalDelegationStatus.EXPIRED;
  }
  return row.status;
}

function statusWhere(
  status: ApprovalDelegationStatus | undefined,
  today: Date,
): Prisma.ApprovalDelegationWhereInput {
  switch (status) {
    case ApprovalDelegationStatus.ACTIVE:
      return {
        status: ApprovalDelegationStatus.ACTIVE,
        validTo: { gte: today },
      };
    case ApprovalDelegationStatus.EXPIRED:
      return {
        OR: [
          { status: ApprovalDelegationStatus.EXPIRED },
          {
            status: ApprovalDelegationStatus.ACTIVE,
            validTo: { lt: today },
          },
        ],
      };
    case ApprovalDelegationStatus.REVOKED:
      return { status: ApprovalDelegationStatus.REVOKED };
    default:
      return {};
  }
}

function searchWhere(q: string | undefined): Prisma.UserWhereInput {
  const term = q?.trim();
  if (!term) return {};
  return {
    OR: [
      { fullName: { contains: term, mode: 'insensitive' } },
      { userCode: { contains: term, mode: 'insensitive' } },
      { username: { contains: term, mode: 'insensitive' } },
    ],
  };
}

const option = (user: DelegationUserOptionDto): DelegationUserOptionDto => ({
  id: user.id,
  userCode: user.userCode,
  fullName: user.fullName,
});

const toVnDay = (day: Date): string =>
  toIsoDay(day).split('-').reverse().join('/');
