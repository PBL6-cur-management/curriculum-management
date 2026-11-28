import { Injectable, Logger } from '@nestjs/common';
import {
  SubjectGroupMemberRole,
  SubjectGroupStatus,
  UserStatus,
} from '../../generated/prisma/client.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  addMembership,
  coordinatorRowsInside,
  endMembership,
  findLiveMember,
  MEMBER_SELECT,
  type MemberRow,
} from '../../shared/subject-groups/membership.writer.js';
import { fromIsoDay, todayDate, toIsoDay } from '../../shared/time/today.js';
import { overlapsPeriod, parsePeriod } from '../../shared/time/validity.js';
import { AddSubjectGroupMemberDto } from './add-subject-group-member.dto.js';
import { EndSubjectGroupMemberDto } from './end-subject-group-member.dto.js';
import type {
  DemoteCoordinatorDto,
  PromoteCoordinatorDto,
} from './promote-coordinator.dto.js';
import {
  SubjectGroupMemberDto,
  toSubjectGroupMemberDto,
  UserSubjectGroupMembershipDto,
} from './subject-group-member.dto.js';
import { SUBJECT_GROUP_ERRORS } from './subject-groups.errors.js';

const ONE_DAY_MS = 86_400_000;

@Injectable()
export class SubjectGroupMembersService {
  private readonly logger = new Logger(SubjectGroupMembersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async add(
    groupId: string,
    dto: AddSubjectGroupMemberDto,
    actorId: string,
  ): Promise<SubjectGroupMemberDto> {
    const row = await addMembership(this.prisma, groupId, dto, actorId);
    this.logger.log(
      `${dto.memberRole} ${dto.lecturerId} added to group ${groupId} by ${actorId}`,
    );
    return toSubjectGroupMemberDto(row, todayDate());
  }

  async end(
    groupId: string,
    memberId: string,
    dto: EndSubjectGroupMemberDto,
    actorId: string,
  ): Promise<SubjectGroupMemberDto[]> {
    const changed = await this.prisma.$transaction((tx) =>
      endMembership(tx, groupId, memberId, dto.validTo, actorId),
    );
    this.logger.log(
      `Member row ${memberId} ended ${dto.validTo} by ${actorId}; ${changed.length - 1} coordinator row(s) adjusted`,
    );
    const today = todayDate();
    return changed.map((member) => toSubjectGroupMemberDto(member, today));
  }

  async revoke(
    groupId: string,
    memberId: string,
    actorId: string,
  ): Promise<SubjectGroupMemberDto> {
    const row = await findLiveMember(this.prisma, groupId, memberId);
    if (
      row.memberRole === SubjectGroupMemberRole.MEMBER &&
      (await coordinatorRowsInside(this.prisma, row)).length > 0
    )
      throw new AppException(SUBJECT_GROUP_ERRORS.MEMBER_HAS_COORDINATOR);
    const updated = await this.prisma.subjectGroupMember.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), revokedById: actorId },
      select: MEMBER_SELECT,
    });
    this.logger.log(`Member row ${row.id} revoked by ${actorId}`);
    return toSubjectGroupMemberDto(updated, todayDate());
  }

  async promoteCoordinator(
    groupId: string,
    lecturerId: string,
    dto: PromoteCoordinatorDto = {},
    actorId: string,
  ): Promise<SubjectGroupMemberDto> {
    const today = todayDate();
    const validFromDay = dto.validFrom ?? toIsoDay(today);
    const created = await this.prisma.$transaction(async (tx) => {
      const group = await tx.subjectGroup.findUnique({
        where: { id: groupId },
      });
      if (!group)
        throw new AppException(SUBJECT_GROUP_ERRORS.SUBJECT_GROUP_NOT_FOUND);
      if (group.status !== SubjectGroupStatus.ACTIVE)
        throw new AppException(SUBJECT_GROUP_ERRORS.SUBJECT_GROUP_INACTIVE);
      const lecturer = await tx.user.findUnique({ where: { id: lecturerId } });
      if (!lecturer || lecturer.status !== UserStatus.ACTIVE)
        throw new AppException(SUBJECT_GROUP_ERRORS.LECTURER_INVALID);

      const requestedPeriod = parsePeriod(validFromDay, dto.validTo);
      const coordinatorClash = await tx.subjectGroupMember.findFirst({
        where: {
          subjectGroupId: group.id,
          lecturerId: lecturer.id,
          memberRole: SubjectGroupMemberRole.COORDINATOR,
          revokedAt: null,
          ...overlapsPeriod(requestedPeriod),
        },
      });
      if (coordinatorClash)
        throw new AppException(SUBJECT_GROUP_ERRORS.MEMBERSHIP_OVERLAP);

      let coordinatorPeriod = requestedPeriod;
      const coveringMember = await tx.subjectGroupMember.findFirst({
        where: {
          subjectGroupId: group.id,
          lecturerId: lecturer.id,
          memberRole: SubjectGroupMemberRole.MEMBER,
          revokedAt: null,
          validFrom: { lte: requestedPeriod.validFrom },
          ...(requestedPeriod.validTo
            ? {
                OR: [
                  { validTo: null },
                  { validTo: { gte: requestedPeriod.validTo } },
                ],
              }
            : { validTo: null }),
        },
      });

      if (!coveringMember) {
        const overlappingMember = await tx.subjectGroupMember.findFirst({
          where: {
            subjectGroupId: group.id,
            lecturerId: lecturer.id,
            memberRole: SubjectGroupMemberRole.MEMBER,
            revokedAt: null,
            ...overlapsPeriod(requestedPeriod),
          },
        });
        if (!overlappingMember) {
          await tx.subjectGroupMember.create({
            data: {
              subjectGroupId: group.id,
              lecturerId: lecturer.id,
              memberRole: SubjectGroupMemberRole.MEMBER,
              ...requestedPeriod,
              assignedById: actorId,
            },
            select: MEMBER_SELECT,
          });
        } else if (
          dto.validTo === undefined &&
          overlappingMember.validFrom <= requestedPeriod.validFrom &&
          overlappingMember.validTo !== null &&
          overlappingMember.validTo >= requestedPeriod.validFrom
        ) {
          coordinatorPeriod = {
            validFrom: requestedPeriod.validFrom,
            validTo: overlappingMember.validTo,
          };
        } else {
          const extendedFrom =
            overlappingMember.validFrom < requestedPeriod.validFrom
              ? overlappingMember.validFrom
              : requestedPeriod.validFrom;
          const extendedTo =
            requestedPeriod.validTo === null ||
            overlappingMember.validTo === null
              ? null
              : overlappingMember.validTo > requestedPeriod.validTo
                ? overlappingMember.validTo
                : requestedPeriod.validTo;
          await tx.subjectGroupMember.update({
            where: { id: overlappingMember.id },
            data: { validFrom: extendedFrom, validTo: extendedTo },
            select: MEMBER_SELECT,
          });
        }
      }

      return tx.subjectGroupMember.create({
        data: {
          subjectGroupId: group.id,
          lecturerId: lecturer.id,
          memberRole: SubjectGroupMemberRole.COORDINATOR,
          ...coordinatorPeriod,
          assignedById: actorId,
        },
        select: MEMBER_SELECT,
      });
    });
    this.logger.log(
      `Lecturer ${lecturerId} promoted to COORDINATOR in group ${groupId} by ${actorId}`,
    );
    return toSubjectGroupMemberDto(created, today);
  }

  async demoteCoordinator(
    groupId: string,
    lecturerId: string,
    dto: DemoteCoordinatorDto = {},
    actorId: string,
  ): Promise<SubjectGroupMemberDto[]> {
    const today = todayDate();
    const explicitEnd = dto.validTo ? fromIsoDay(dto.validTo) : null;
    const cutoff = explicitEnd ?? new Date(today.getTime() - ONE_DAY_MS);
    const activeFloor = explicitEnd ?? today;
    const changed = await this.prisma.$transaction(async (tx) => {
      const group = await tx.subjectGroup.findUnique({
        where: { id: groupId },
      });
      if (!group)
        throw new AppException(SUBJECT_GROUP_ERRORS.SUBJECT_GROUP_NOT_FOUND);
      const rows = await tx.subjectGroupMember.findMany({
        where: {
          subjectGroupId: group.id,
          lecturerId,
          memberRole: SubjectGroupMemberRole.COORDINATOR,
          revokedAt: null,
          OR: [{ validTo: null }, { validTo: { gte: activeFloor } }],
        },
        orderBy: { validFrom: 'asc' },
      });
      if (rows.length === 0)
        throw new AppException(SUBJECT_GROUP_ERRORS.MEMBER_NOT_FOUND);
      if (explicitEnd && rows.every((row) => explicitEnd < row.validFrom)) {
        // When an explicit validTo precedes a live active row's validFrom, reject reversed dates
        const activeNow = rows.find((row) => row.validFrom <= today);
        if (activeNow && explicitEnd < activeNow.validFrom)
          throw new AppException(COMMON_ERRORS.VALIDITY_INVALID);
      }
      const now = new Date();
      const result: MemberRow[] = [];
      for (const row of rows) {
        if (row.validFrom > cutoff) {
          result.push(
            await tx.subjectGroupMember.update({
              where: { id: row.id },
              data: { revokedAt: now, revokedById: actorId },
              select: MEMBER_SELECT,
            }),
          );
        } else {
          result.push(
            await tx.subjectGroupMember.update({
              where: { id: row.id },
              data: { validTo: cutoff },
              select: MEMBER_SELECT,
            }),
          );
        }
      }
      return result;
    });
    this.logger.log(
      `Lecturer ${lecturerId} demoted from COORDINATOR in group ${groupId} by ${actorId}`,
    );
    return changed.map((row) => toSubjectGroupMemberDto(row, today));
  }

  async membershipsOf(
    userId: string,
  ): Promise<UserSubjectGroupMembershipDto[]> {
    const rows = await this.prisma.subjectGroupMember.findMany({
      where: { lecturerId: userId },
      select: {
        ...MEMBER_SELECT,
        subjectGroup: {
          select: { id: true, groupCode: true, groupName: true, status: true },
        },
      },
      orderBy: { validFrom: 'desc' },
    });
    const today = todayDate();
    return rows.map((row) =>
      Object.assign(toSubjectGroupMemberDto(row, today), {
        subjectGroup: row.subjectGroup,
      }),
    );
  }
}
