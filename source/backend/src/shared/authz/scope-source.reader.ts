import { Injectable } from '@nestjs/common';
import {
  ScopeSource,
  SubjectGroupMemberRole,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { activeDirectorWhere } from '../programs/active-director.js';
import { activeMembershipWhere } from '../subject-groups/active-membership.js';
import type { ScopeTarget } from './access-context.js';

@Injectable()
export class ScopeSourceReader {
  constructor(private readonly prisma: PrismaService) {}

  async activeTargets(
    source: Exclude<ScopeSource, 'NONE'>,
    userId: string,
    today: Date,
  ): Promise<ScopeTarget> {
    switch (source) {
      case ScopeSource.PROGRAM_DIRECTOR:
        return { programIds: await this.directedProgramIds(userId, today) };
      case ScopeSource.OWN_ENROLLMENT:
        return this.ownStudent(userId);
      case ScopeSource.SUBJECT_GROUP_COORDINATOR:
        return {
          subjectGroupIds: await this.activeGroupIds(
            userId,
            today,
            SubjectGroupMemberRole.COORDINATOR,
          ),
        };
      case ScopeSource.SUBJECT_GROUP_MEMBER:
        return { subjectGroupIds: await this.activeGroupIds(userId, today) };
    }
  }

  // Past programs stay readable so a student can see their own history; an account with no student record derives nothing.
  private async ownStudent(userId: string): Promise<ScopeTarget> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: {
        id: true,
        enrollments: { select: { programId: true }, distinct: ['programId'] },
      },
    });
    if (!student) return {};
    return {
      studentIds: [student.id],
      programIds: student.enrollments.map((row) => row.programId),
    };
  }

  private async directedProgramIds(
    directorId: string,
    today: Date,
  ): Promise<string[]> {
    const rows = await this.prisma.programDirectorAssignment.findMany({
      where: { directorId, ...activeDirectorWhere(today) },
      select: { programId: true },
      distinct: ['programId'],
    });
    return rows.map((row) => row.programId);
  }

  private async activeGroupIds(
    lecturerId: string,
    today: Date,
    memberRole?: SubjectGroupMemberRole,
  ): Promise<string[]> {
    const rows = await this.prisma.subjectGroupMember.findMany({
      where: {
        lecturerId,
        ...(memberRole && { memberRole }),
        ...activeMembershipWhere(today),
      },
      select: { subjectGroupId: true },
      distinct: ['subjectGroupId'],
    });
    return rows.map((row) => row.subjectGroupId);
  }
}
