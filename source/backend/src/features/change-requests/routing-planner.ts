import { Injectable } from '@nestjs/common';
import {
  ChangeRequestType,
  ProgramStatus,
  ProgramVersionStatus,
  SubjectGroupMemberRole,
  type Prisma,
} from '../../generated/prisma/client.js';
import {
  APPROVAL_LEVEL,
  SKIP_REASONS,
  type ApprovalLevel,
} from '../../shared/change-requests/approval.constants.js';
import {
  AUTHORED_ENTITY,
  AUTHORED_OPERATION,
  type AuthoredPayload,
} from '../../shared/change-requests/authored-item.types.js';
import { groupBy } from '../../shared/collections/group-by.js';
import {
  isAcademicOfficeHolder,
  otherAcademicOfficeHolderExists,
} from '../../shared/change-requests/academic-office.js';
import {
  SNAPSHOT_ENTITY,
  type ChangeItemDraft,
} from '../../shared/change-requests/diff/snapshot-entry.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { HOME_FACULTY_CODE } from '../../shared/org-units/home-faculty.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { maySelfApprove } from '../../shared/change-requests/self-approval.js';
import { activeDirectorWhere } from '../../shared/programs/active-director.js';
import { activeMembershipWhere } from '../../shared/subject-groups/active-membership.js';
import { SUBMISSION_ERRORS } from './change-request-feature.errors.js';

type Db = PrismaService | Prisma.TransactionClient;

export interface PlannedStep {
  approvalLevel: ApprovalLevel;
  approverId: string | null;
  forSubjectGroupId: string | null;
  forProgramId: string | null;
  isSkipped: boolean;
  skipReason: string | null;
  // Display only (the submit preview); not stored.
  approverName: string | null;
  scopeLabel: string | null;
}

export interface AffectedProgram {
  id: string;
  programCode: string;
  programName: string;
}

export interface RoutingPlan {
  steps: PlannedStep[];
  affectedPrograms: AffectedProgram[];
}

export interface RoutingSubject {
  requestType: ChangeRequestType;
  createdById: string;
  courseId: string | null;
  programId: string | null;
  course: {
    id: string;
    ownerGroupId: string | null;
    ownerFacultyCode: string;
  } | null;
}

interface RoutedCourse {
  id: string;
  ownerGroupId: string | null;
}

const COURSE_BEARING_ENTITIES: readonly string[] = [
  SNAPSHOT_ENTITY.CURRICULUM_ITEM,
  SNAPSHOT_ENTITY.CURRICULUM_REQUISITE,
  SNAPSHOT_ENTITY.COURSE_PLO,
  SNAPSHOT_ENTITY.CLO_PLO,
];
const ACTIVE_OR_PENDING = [
  ProgramVersionStatus.ACTIVE,
  ProgramVersionStatus.PENDING,
];
const KEY_SEPARATOR = '|';

function skipped(
  approvalLevel: ApprovalLevel,
  reason: string,
  scope: Partial<
    Pick<PlannedStep, 'forSubjectGroupId' | 'forProgramId' | 'scopeLabel'>
  > = {},
): PlannedStep {
  return {
    approvalLevel,
    approverId: null,
    forSubjectGroupId: null,
    forProgramId: null,
    isSkipped: true,
    skipReason: reason,
    approverName: null,
    scopeLabel: null,
    ...scope,
  };
}

// Who must approve a request, level by level, fixed at submit (D6). A pure function of the database and the items,
// so the preview and the submit cannot disagree. Every row at a level must approve (D7).
@Injectable()
export class RoutingPlanner {
  async plan(
    db: Db,
    request: RoutingSubject,
    items: readonly ChangeItemDraft[],
    today: Date,
  ): Promise<RoutingPlan> {
    const academicOffice = await this.academicOfficeStep(
      db,
      request.createdById,
      today,
    );
    // Organisational requests never had levels 1 and 2 (D16): no "skipped" history is written.
    if (request.requestType === ChangeRequestType.ORGANIZATION) {
      return { steps: [academicOffice], affectedPrograms: [] };
    }
    // A relation also concerns the course at its other end, so a foreign request course is not enough to skip.
    const relationRouting =
      request.requestType === ChangeRequestType.COURSE_RELATION;
    const relationCourses = relationRouting
      ? await this.affectedHomeCourses(db, request, items)
      : null;
    if (
      request.course &&
      request.course.ownerFacultyCode !== HOME_FACULTY_CODE &&
      (relationCourses?.courses.length ?? 0) === 0
    ) {
      return {
        steps: [
          skipped(APPROVAL_LEVEL.COORDINATOR, SKIP_REASONS.FOREIGN_COURSE),
          skipped(APPROVAL_LEVEL.DIRECTOR, SKIP_REASONS.FOREIGN_COURSE),
          academicOffice,
        ],
        affectedPrograms: [],
      };
    }
    const { courses, touchesCourses } =
      relationCourses ?? (await this.affectedHomeCourses(db, request, items));
    const programs = request.programId
      ? await this.programById(db, request.programId)
      : relationRouting
        ? await this.programsUsingAny(db, courses)
        : await this.programsUsing(db, request.courseId!);
    const steps = [
      ...(await this.coordinatorSteps(
        db,
        courses,
        // Only other faculties' courses changed (e.g. a mathematics course moved): no coordinator here (EC-24).
        touchesCourses ? SKIP_REASONS.FOREIGN_COURSE : SKIP_REASONS.NO_COURSE,
        today,
      )),
      ...(await this.directorSteps(
        db,
        programs,
        request.course !== null,
        today,
      )),
      academicOffice,
    ];
    const creatorSelfApproves = await maySelfApprove(db, request.createdById);
    return {
      steps: steps.map((step) =>
        // FR-61, BR-27: nobody approves their own request; the row stays as a record. Demo accounts excepted.
        step.approverId !== null &&
        step.approverId === request.createdById &&
        !creatorSelfApproves
          ? { ...step, isSkipped: true, skipReason: SKIP_REASONS.CREATOR }
          : step,
      ),
      affectedPrograms: programs,
    };
  }

  // Level 3 is an office, not a person: the row has no approver and any other active R1 acts on it (D8, F13-01).
  private async academicOfficeStep(
    db: Db,
    creatorId: string,
    today: Date,
  ): Promise<PlannedStep> {
    if (
      (await isAcademicOfficeHolder(db, creatorId, today)) &&
      !(await otherAcademicOfficeHolderExists(db, creatorId, today)) &&
      !(await maySelfApprove(db, creatorId))
    ) {
      throw new AppException(SUBMISSION_ERRORS.NO_OTHER_ACADEMIC_OFFICE);
    }
    return {
      approvalLevel: APPROVAL_LEVEL.ACADEMIC_OFFICE,
      approverId: null,
      forSubjectGroupId: null,
      forProgramId: null,
      isSkipped: false,
      skipReason: null,
      approverName: null,
      scopeLabel: null,
    };
  }

  // A course target is that course; a program copy touches the courses named by its curriculum, requisite and matrix
  // changes. Courses of other faculties have no coordinator here and drop out (EC-24).
  private async affectedHomeCourses(
    db: Db,
    request: RoutingSubject,
    items: readonly ChangeItemDraft[],
  ): Promise<{ courses: RoutedCourse[]; touchesCourses: boolean }> {
    if (request.requestType === ChangeRequestType.COURSE_RELATION) {
      const ids = new Set(request.courseId ? [request.courseId] : []);
      for (const id of await this.relationEndIds(db, items)) ids.add(id);
      const courses = await db.course.findMany({
        where: {
          id: { in: [...ids] },
          ownerFaculty: { unitCode: HOME_FACULTY_CODE },
        },
        select: { id: true, ownerGroupId: true },
      });
      return { courses, touchesCourses: true };
    }
    if (request.course) {
      return {
        courses: [
          { id: request.course.id, ownerGroupId: request.course.ownerGroupId },
        ],
        touchesCourses: true,
      };
    }
    const codes = [
      ...new Set(
        items
          .filter((item) => COURSE_BEARING_ENTITIES.includes(item.entityType))
          .map((item) => item.itemKey.split(KEY_SEPARATOR)[0]),
      ),
    ];
    if (codes.length === 0) return { courses: [], touchesCourses: false };
    const courses = await db.course.findMany({
      where: {
        courseCode: { in: codes },
        ownerFaculty: { unitCode: HOME_FACULTY_CODE },
      },
      select: { id: true, ownerGroupId: true },
    });
    return { courses, touchesCourses: true };
  }

  // An added relation names both ends in its payload; an update or removal names only the relation row.
  private async relationEndIds(
    db: Db,
    items: readonly ChangeItemDraft[],
  ): Promise<string[]> {
    const ids: string[] = [];
    const relationIds: string[] = [];
    for (const item of items) {
      if (item.entityType !== AUTHORED_ENTITY.COURSE_RELATION) continue;
      const payload = item.newValue as AuthoredPayload | null;
      if (payload?.operation === AUTHORED_OPERATION.ADD_RELATION) {
        ids.push(payload.sourceCourseId, payload.targetCourseId);
      } else if (item.recordId) {
        relationIds.push(item.recordId);
      }
    }
    if (relationIds.length > 0) {
      const rows = await db.courseRelation.findMany({
        where: { id: { in: relationIds } },
        select: { sourceCourseId: true, targetCourseId: true },
      });
      for (const row of rows) ids.push(row.sourceCourseId, row.targetCourseId);
    }
    return ids;
  }

  private async coordinatorSteps(
    db: Db,
    courses: readonly RoutedCourse[],
    noCourseReason: string,
    today: Date,
  ): Promise<PlannedStep[]> {
    if (courses.length === 0) {
      return [skipped(APPROVAL_LEVEL.COORDINATOR, noCourseReason)];
    }
    const steps: PlannedStep[] = [];
    if (courses.some((course) => course.ownerGroupId === null)) {
      steps.push(skipped(APPROVAL_LEVEL.COORDINATOR, SKIP_REASONS.NO_GROUP));
    }
    const groupIds = [
      ...new Set(
        courses.flatMap((c) => (c.ownerGroupId ? [c.ownerGroupId] : [])),
      ),
    ];
    if (groupIds.length === 0) return steps;
    const groups = await db.subjectGroup.findMany({
      where: { id: { in: groupIds } },
      select: { id: true, groupCode: true },
      orderBy: { groupCode: 'asc' },
    });
    const members = await db.subjectGroupMember.findMany({
      where: {
        subjectGroupId: { in: groupIds },
        memberRole: SubjectGroupMemberRole.COORDINATOR,
        ...activeMembershipWhere(today),
      },
      select: {
        subjectGroupId: true,
        lecturerId: true,
        lecturer: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const byGroup = groupBy(members, (member) => member.subjectGroupId);
    for (const group of groups) {
      const seen = new Set<string>();
      const coordinators = (byGroup.get(group.id) ?? []).filter((member) =>
        seen.has(member.lecturerId)
          ? false
          : (seen.add(member.lecturerId), true),
      );
      if (coordinators.length === 0) {
        throw new AppException({
          ...SUBMISSION_ERRORS.NO_COORDINATOR,
          message: `${SUBMISSION_ERRORS.NO_COORDINATOR.message} Mã nhóm: ${group.groupCode}.`,
        });
      }
      for (const member of coordinators) {
        steps.push({
          approvalLevel: APPROVAL_LEVEL.COORDINATOR,
          approverId: member.lecturerId,
          forSubjectGroupId: group.id,
          forProgramId: null,
          isSkipped: false,
          skipReason: null,
          approverName: member.lecturer.fullName,
          scopeLabel: group.groupCode,
        });
      }
    }
    return steps;
  }

  private async directorSteps(
    db: Db,
    programs: readonly AffectedProgram[],
    courseTarget: boolean,
    today: Date,
  ): Promise<PlannedStep[]> {
    if (programs.length === 0) {
      return courseTarget
        ? [skipped(APPROVAL_LEVEL.DIRECTOR, SKIP_REASONS.NO_PROGRAM)]
        : [];
    }
    const assignments = await db.programDirectorAssignment.findMany({
      where: {
        programId: { in: programs.map((program) => program.id) },
        ...activeDirectorWhere(today),
      },
      select: {
        programId: true,
        directorId: true,
        director: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const byProgram = groupBy(assignments, (row) => row.programId);
    const steps: PlannedStep[] = [];
    for (const program of programs) {
      const seen = new Set<string>();
      const directors = (byProgram.get(program.id) ?? []).filter((row) =>
        seen.has(row.directorId) ? false : (seen.add(row.directorId), true),
      );
      if (directors.length === 0) {
        throw new AppException({
          ...SUBMISSION_ERRORS.NO_DIRECTOR,
          message: `${SUBMISSION_ERRORS.NO_DIRECTOR.message} Mã chương trình: ${program.programCode}.`,
        });
      }
      for (const row of directors) {
        steps.push({
          approvalLevel: APPROVAL_LEVEL.DIRECTOR,
          approverId: row.directorId,
          forSubjectGroupId: null,
          forProgramId: program.id,
          isSkipped: false,
          skipReason: null,
          approverName: row.director.fullName,
          scopeLabel: program.programCode,
        });
      }
    }
    return steps;
  }

  private async programById(
    db: Db,
    programId: string,
  ): Promise<AffectedProgram[]> {
    const program = await db.program.findUnique({
      where: { id: programId },
      select: PROGRAM_NAME_SELECT,
    });
    return program ? [toAffected(program)] : [];
  }

  private async programsUsingAny(
    db: Db,
    courses: readonly RoutedCourse[],
  ): Promise<AffectedProgram[]> {
    const byId = new Map<string, AffectedProgram>();
    for (const course of courses) {
      for (const program of await this.programsUsing(db, course.id)) {
        byId.set(program.id, program);
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.programCode.localeCompare(b.programCode),
    );
  }

  // Programs in force (Active or Pending version, not a working copy) that list the course (US-057 AC3, EC-23).
  private async programsUsing(
    db: Db,
    courseId: string,
  ): Promise<AffectedProgram[]> {
    const programs = await db.program.findMany({
      where: {
        status: ProgramStatus.ACTIVE,
        versions: {
          some: {
            sourceRequestId: null,
            status: { in: ACTIVE_OR_PENDING },
            curriculumItems: { some: { courseId } },
          },
        },
      },
      select: PROGRAM_NAME_SELECT,
      orderBy: { programCode: 'asc' },
    });
    return programs.map(toAffected);
  }
}

const PROGRAM_NAME_SELECT = {
  id: true,
  programCode: true,
  versions: {
    where: { sourceRequestId: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { programName: true },
  },
} as const satisfies Prisma.ProgramSelect;

function toAffected(program: {
  id: string;
  programCode: string;
  versions: { programName: string }[];
}): AffectedProgram {
  return {
    id: program.id,
    programCode: program.programCode,
    programName: program.versions[0]?.programName ?? program.programCode,
  };
}
