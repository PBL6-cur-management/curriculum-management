import { Injectable, Logger } from '@nestjs/common';
import {
  CourseRelationType,
  CourseStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import {
  assertDirectEdit,
  editPathFor,
  type EditState,
} from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import {
  assertCourseOwners,
  type Owners,
} from '../../shared/courses/course.writer.js';
import { courseEditState } from '../../shared/courses/course-edit-state.js';
import { courseTarget } from '../../shared/courses/course-target.js';
import { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import {
  RELATED_COURSE_SELECT,
  toRelatedCourseDto,
} from '../../shared/courses/related-course.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import { HOME_FACULTY_CODE } from '../../shared/org-units/home-faculty.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import {
  COURSE_TRANSITION,
  COURSE_TRANSITIONS,
  type CourseTransition,
} from './course-status.js';
import { CourseQueryDto } from './course-query.dto.js';
import {
  COURSE_INCLUDE,
  toCourseSummaryDto,
  type CourseDetailDto,
  type CourseRow,
  type CourseSummaryDto,
} from './course.dto.js';
import { COURSE_ERRORS } from './courses.errors.js';
import { CreateCourseDto } from './create-course.dto.js';
import { UpdateCourseDto } from './update-course.dto.js';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: CourseUsageReader,
  ) {}

  async list(
    query: CourseQueryDto,
    access: AccessContext,
  ): Promise<Page<CourseSummaryDto>> {
    const where = this.listWhere(query, access);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        include: COURSE_INCLUDE,
        orderBy: [{ [query.sort]: query.order }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.course.count({ where }),
    ]);
    return toPage(rows.map(toCourseSummaryDto), total, query);
  }

  async detail(
    courseId: string,
    access: AccessContext,
  ): Promise<CourseDetailDto> {
    const row = await this.findVisibleOrThrow(courseId, access);
    return this.toDetail(row, access);
  }

  async create(
    dto: CreateCourseDto,
    access: AccessContext,
  ): Promise<CourseDetailDto> {
    const owners = await this.assertOwners(
      dto.ownerFacultyId,
      dto.ownerGroupId ?? null,
    );
    assertDirectEdit(
      access,
      PERMISSIONS.COURSE_EDIT,
      courseTarget(owners),
      newObjectState(owners),
    );
    try {
      const row = await this.prisma.course.create({
        data: {
          courseCode: dto.courseCode,
          courseName: dto.courseName,
          englishName: dto.englishName ?? null,
          credits: new Prisma.Decimal(dto.credits),
          courseType: dto.courseType,
          ownerFacultyId: owners.ownerFacultyId,
          ownerGroupId: owners.ownerGroupId,
        },
        include: COURSE_INCLUDE,
      });
      this.logger.log(`Course ${row.courseCode} created by ${access.userId}`);
      return await this.toDetail(row, access);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        COURSE_ERRORS.COURSE_CODE_TAKEN,
        'courseCode',
      );
    }
  }

  async update(
    courseId: string,
    dto: UpdateCourseDto,
    access: AccessContext,
  ): Promise<CourseDetailDto> {
    const current = await this.findOrThrow(courseId);
    if (current.status === CourseStatus.CANCELLED) {
      throw new AppException(COURSE_ERRORS.COURSE_CANCELLED);
    }
    assertDirectEdit(
      access,
      PERMISSIONS.COURSE_EDIT,
      courseTarget(current),
      await courseEditState(this.usage, current),
    );
    const nextFacultyId = dto.ownerFacultyId ?? current.ownerFacultyId;
    const nextGroupId =
      dto.ownerGroupId === undefined ? current.ownerGroupId : dto.ownerGroupId;
    const ownersChange =
      nextFacultyId !== current.ownerFacultyId ||
      nextGroupId !== current.ownerGroupId;
    const owners = ownersChange
      ? await this.assertOwners(nextFacultyId, nextGroupId)
      : null;
    if (owners) {
      // Moving a course into another group or faculty needs the right on the destination too.
      assertDirectEdit(
        access,
        PERMISSIONS.COURSE_EDIT,
        courseTarget(owners),
        newObjectState(owners),
      );
    }
    const row = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        courseName: dto.courseName,
        englishName: dto.englishName,
        credits:
          dto.credits === undefined
            ? undefined
            : new Prisma.Decimal(dto.credits),
        courseType: dto.courseType,
        ownerFacultyId: owners?.ownerFacultyId,
        ownerGroupId: owners ? owners.ownerGroupId : undefined,
      },
      include: COURSE_INCLUDE,
    });
    this.logger.log(`Course ${row.courseCode} updated by ${access.userId}`);
    return this.toDetail(row, access);
  }

  async transition(
    courseId: string,
    transition: CourseTransition,
    access: AccessContext,
    options: { replacementCourseId?: string } = {},
  ): Promise<CourseDetailDto> {
    const current = await this.findOrThrow(courseId);
    if (current.status === CourseStatus.CANCELLED) {
      throw new AppException(COURSE_ERRORS.COURSE_CANCELLED);
    }
    // HP-02..HP-04 are R1 actions: the raw mode must be DIRECT, draft-open does not apply (D6).
    if (
      access.assertCan(PERMISSIONS.COURSE_EDIT, courseTarget(current)) !==
      'DIRECT'
    ) {
      throw new AppException(COMMON_ERRORS.CHANGE_REQUEST_REQUIRED);
    }
    const rule = COURSE_TRANSITIONS[transition];
    if (!rule.from.includes(current.status)) {
      throw new AppException(COURSE_ERRORS.STATUS_TRANSITION_INVALID);
    }
    if (
      transition === COURSE_TRANSITION.CANCEL &&
      (await this.isInUse(courseId))
    ) {
      throw new AppException(COURSE_ERRORS.COURSE_IN_USE);
    }
    const row =
      transition === COURSE_TRANSITION.DISCONTINUE
        ? await this.discontinue(current, options.replacementCourseId)
        : await this.prisma.course.update({
            where: { id: courseId },
            data: { status: rule.to },
            include: COURSE_INCLUDE,
          });
    this.logger.log(
      `Course ${row.courseCode} ${transition} by ${access.userId}`,
    );
    return this.toDetail(row, access);
  }

  // The replacement relation and the status change commit together or not at all (D11).
  private discontinue(
    current: CourseRow,
    replacementCourseId: string | undefined,
  ): Promise<CourseRow> {
    return this.prisma.$transaction(async (tx) => {
      if (replacementCourseId) {
        await this.addReplacement(tx, current, replacementCourseId);
      }
      if (!(await this.usage.hasActiveReplacement(current.id, tx))) {
        throw new AppException(COURSE_ERRORS.REPLACEMENT_REQUIRED);
      }
      return tx.course.update({
        where: { id: current.id },
        data: { status: CourseStatus.DISCONTINUED },
        include: COURSE_INCLUDE,
      });
    });
  }

  private async addReplacement(
    tx: Prisma.TransactionClient,
    course: CourseRow,
    replacementCourseId: string,
  ): Promise<void> {
    if (replacementCourseId === course.id) {
      throw new AppException(COURSE_ERRORS.REPLACEMENT_INVALID);
    }
    const replacement = await tx.course.findUnique({
      where: { id: replacementCourseId },
      select: { status: true },
    });
    if (!replacement || replacement.status !== CourseStatus.ACTIVE) {
      throw new AppException(COURSE_ERRORS.REPLACEMENT_INVALID);
    }
    await tx.courseRelation.upsert({
      where: {
        sourceCourseId_targetCourseId_relationType: {
          sourceCourseId: course.id,
          targetCourseId: replacementCourseId,
          relationType: CourseRelationType.REPLACEMENT,
        },
      },
      create: {
        sourceCourseId: course.id,
        targetCourseId: replacementCourseId,
        relationType: CourseRelationType.REPLACEMENT,
      },
      update: {},
    });
  }

  private listWhere(
    query: CourseQueryDto,
    access: AccessContext,
  ): Prisma.CourseWhereInput {
    const and: Prisma.CourseWhereInput[] = [];
    if (query.q) {
      and.push({
        OR: [
          { courseCode: { contains: query.q, mode: 'insensitive' } },
          { courseName: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.foreign !== undefined) {
      and.push({
        ownerFaculty: {
          unitCode: query.foreign
            ? { not: HOME_FACULTY_CODE }
            : HOME_FACULTY_CODE,
        },
      });
    }
    if (!access.has(PERMISSIONS.COURSE_EDIT)) {
      and.push({ status: { not: CourseStatus.CANCELLED } });
    }
    return {
      ownerFacultyId: query.ownerFacultyId,
      ownerGroupId: query.ownerGroupId,
      courseType: query.courseType,
      status: query.status ? { in: query.status } : undefined,
      AND: and,
    };
  }

  private async toDetail(
    row: CourseRow,
    access: AccessContext,
  ): Promise<CourseDetailDto> {
    const cancelled = row.status === CourseStatus.CANCELLED;
    const target = courseTarget(row);
    const [programsUsing, state, equivalenceGroup] = await Promise.all([
      this.usage.programsUsing(row.id),
      courseEditState(this.usage, row),
      this.equivalents(row),
    ]);
    return Object.assign(toCourseSummaryDto(row), {
      programsUsing,
      editPath: cancelled
        ? null
        : editPathFor(access, PERMISSIONS.COURSE_EDIT, target, state),
      canChangeStatus:
        !cancelled &&
        access.modeFor(PERMISSIONS.COURSE_EDIT, target) === 'DIRECT',
      equivalenceGroup,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  // The group the course belongs to, listing the other members only (US-017 AC1).
  private async equivalents(
    row: CourseRow,
  ): Promise<CourseDetailDto['equivalenceGroup']> {
    if (row.equivalenceGroupId === null) {
      return null;
    }
    const group = await this.prisma.equivalentCourseGroup.findUnique({
      where: { id: row.equivalenceGroupId },
      select: {
        id: true,
        groupCode: true,
        members: {
          where: { id: { not: row.id } },
          select: RELATED_COURSE_SELECT,
          orderBy: { courseCode: 'asc' },
        },
      },
    });
    return group
      ? {
          id: group.id,
          groupCode: group.groupCode,
          members: group.members.map(toRelatedCourseDto),
        }
      : null;
  }

  private async isInUse(courseId: string): Promise<boolean> {
    const [released, results] = await Promise.all([
      this.usage.inReleasedVersion(courseId),
      this.usage.hasStudyResults(courseId),
    ]);
    return released || results;
  }

  private assertOwners(
    ownerFacultyId: string,
    ownerGroupId: string | null,
  ): Promise<Owners> {
    return assertCourseOwners(this.prisma, ownerFacultyId, ownerGroupId);
  }

  private async findOrThrow(courseId: string): Promise<CourseRow> {
    const row = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: COURSE_INCLUDE,
    });
    if (!row) {
      throw new AppException(COURSE_ERRORS.COURSE_NOT_FOUND);
    }
    return row;
  }

  // A Cancelled row is not found without course.edit, before any scope check, so its id stays unknown.
  private async findVisibleOrThrow(
    courseId: string,
    access: AccessContext,
  ): Promise<CourseRow> {
    const row = await this.findOrThrow(courseId);
    if (
      row.status === CourseStatus.CANCELLED &&
      !access.has(PERMISSIONS.COURSE_EDIT)
    ) {
      throw new AppException(COURSE_ERRORS.COURSE_NOT_FOUND);
    }
    return row;
  }
}

// A course being created or moved is not in any version yet.
function newObjectState(owners: Owners): EditState {
  return { released: false, draftOpenToRequestHolders: !owners.isForeign };
}
