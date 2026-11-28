import { Injectable } from '@nestjs/common';
import {
  ChangeTargetType,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { ScopeTarget } from '../../shared/authz/access-context.js';
import { courseTarget } from '../../shared/courses/course-target.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import { CHANGE_REQUEST_ERRORS } from './change-request-feature.errors.js';

export interface ResolvedTarget {
  targetType: ChangeTargetType;
  id: string;
  code: string;
  name: string;
  scope: ScopeTarget;
  ownerFacultyCode?: string;
}

type Db = PrismaService | Prisma.TransactionClient;

// Every request entry point resolves its target the same way: code and name for display, scope for permission checks.
@Injectable()
export class RequestTargetResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    targetType: ChangeTargetType,
    id: string,
    db: Db = this.prisma,
  ): Promise<ResolvedTarget> {
    switch (targetType) {
      case ChangeTargetType.COURSE: {
        const course = await db.course.findUnique({
          where: { id },
          select: {
            courseCode: true,
            courseName: true,
            ownerGroupId: true,
            ownerFacultyId: true,
            ownerFaculty: { select: { unitCode: true } },
          },
        });
        if (!course)
          throw new AppException(CHANGE_REQUEST_ERRORS.TARGET_NOT_FOUND);
        return {
          targetType,
          id,
          code: course.courseCode,
          name: course.courseName,
          scope: courseTarget(course),
          ownerFacultyCode: course.ownerFaculty?.unitCode,
        };
      }
      case ChangeTargetType.PROGRAM: {
        const program = await db.program.findUnique({
          where: { id },
          select: {
            id: true,
            programCode: true,
            facultyId: true,
            versions: {
              where: { sourceRequestId: null },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: { programName: true },
            },
          },
        });
        if (!program)
          throw new AppException(CHANGE_REQUEST_ERRORS.TARGET_NOT_FOUND);
        return {
          targetType,
          id,
          code: program.programCode,
          name: program.versions[0]?.programName ?? program.programCode,
          scope: programTarget(program),
        };
      }
      case ChangeTargetType.SUBJECT_GROUP: {
        const group = await db.subjectGroup.findUnique({
          where: { id },
          select: { groupCode: true, groupName: true, facultyId: true },
        });
        if (!group)
          throw new AppException(CHANGE_REQUEST_ERRORS.TARGET_NOT_FOUND);
        return {
          targetType,
          id,
          code: group.groupCode,
          name: group.groupName,
          scope: { subjectGroupIds: [id], orgUnitIds: [group.facultyId] },
        };
      }
    }
  }
}

// Exactly one of the three keys is set (CHECK ChangeRequest_target_key).
export function targetKey(target: Pick<ResolvedTarget, 'targetType' | 'id'>) {
  return {
    courseId: target.targetType === ChangeTargetType.COURSE ? target.id : null,
    programId:
      target.targetType === ChangeTargetType.PROGRAM ? target.id : null,
    subjectGroupId:
      target.targetType === ChangeTargetType.SUBJECT_GROUP ? target.id : null,
  };
}

// For a where clause: only the set key matches.
export function pickTargetKey(key: ReturnType<typeof targetKey>) {
  return {
    ...(key.courseId && { courseId: key.courseId }),
    ...(key.programId && { programId: key.programId }),
    ...(key.subjectGroupId && { subjectGroupId: key.subjectGroupId }),
  };
}
