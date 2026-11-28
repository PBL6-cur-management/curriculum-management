import { Injectable, Logger } from '@nestjs/common';
import {
  CourseStatus,
  MajorStatus,
  OrgUnitStatus,
  OrgUnitType,
  ProgramStatus,
  ProgramVersionStatus,
  SubjectGroupStatus,
  SyllabusStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { assertSchoolWideDirect } from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { ORG_UNIT_REF_SELECT } from '../../shared/dtos/ref.dto.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import {
  MAJOR_INCLUDE,
  toMajorDto,
  type CreateMajorDto,
  type MajorDto,
  type MajorOverviewCohortBreakdownDto,
  type MajorOverviewCourseDto,
  type MajorOverviewDto,
  type MajorOverviewProgramDto,
  type MajorOverviewSubjectGroupDto,
  type MajorQueryDto,
  type MajorStats,
  type UpdateMajorDto,
} from './majors.dto.js';
import { MAJOR_ERRORS } from './majors.errors.js';

const RELEASED_STATUSES: ProgramVersionStatus[] = [
  ProgramVersionStatus.ACTIVE,
  ProgramVersionStatus.HISTORICAL,
];

interface VersionLite {
  id: string;
  versionNumber: string | null;
  status: ProgramVersionStatus;
  programName: string;
  totalCredits: Prisma.Decimal;
  publishedAt: Date | null;
  createdAt: Date;
  _count: { tracks: number; plos: number };
}

function latestOf<T extends { publishedAt: Date | null; createdAt: Date }>(
  rows: T[],
): T | undefined {
  const key = (r: T): number => (r.publishedAt ?? r.createdAt).getTime();
  return [...rows].sort((a, b) => key(b) - key(a))[0];
}

/** ACTIVE first, else latest released (HISTORICAL), else latest remaining (DRAFT/PENDING). */
function pickRepresentative(versions: VersionLite[]): VersionLite | undefined {
  const by = (s: ProgramVersionStatus[]): VersionLite[] =>
    versions.filter((v) => s.includes(v.status));
  return (
    latestOf(by([ProgramVersionStatus.ACTIVE])) ??
    latestOf(by([ProgramVersionStatus.HISTORICAL])) ??
    latestOf(by([ProgramVersionStatus.DRAFT, ProgramVersionStatus.PENDING]))
  );
}

@Injectable()
export class MajorsService {
  private readonly logger = new Logger(MajorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: MajorQueryDto): Promise<Page<MajorDto>> {
    const where: Prisma.MajorWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.facultyId && { facultyId: query.facultyId }),
      ...(query.degreeGroup && { degreeGroup: query.degreeGroup }),
      ...(query.hasPrograms === true && { programs: { some: {} } }),
      ...(query.hasPrograms === false && { programs: { none: {} } }),
      ...(query.q && {
        OR: [
          { majorCode: { contains: query.q, mode: 'insensitive' } },
          { majorName: { contains: query.q, mode: 'insensitive' } },
          { englishName: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.major.findMany({
        where,
        include: MAJOR_INCLUDE,
        orderBy: { majorCode: 'asc' },
        ...toSkipTake(query),
      }),
      this.prisma.major.count({ where }),
    ]);
    const stats = await this.statsFor(rows.map((r) => r.id));
    return toPage(
      rows.map((r) => toMajorDto(r, stats.get(r.id))),
      total,
      query,
    );
  }

  async detail(majorId: string): Promise<MajorDto> {
    const row = await this.prisma.major.findUnique({
      where: { id: majorId },
      include: MAJOR_INCLUDE,
    });
    if (!row) throw new AppException(MAJOR_ERRORS.MAJOR_NOT_FOUND);
    return toMajorDto(row, (await this.statsFor([row.id])).get(row.id));
  }

  async create(dto: CreateMajorDto, access: AccessContext): Promise<MajorDto> {
    assertSchoolWideDirect(access, PERMISSIONS.PROGRAM_EDIT_INFO);
    const facultyId = dto.facultyId
      ? await this.validateFaculty(dto.facultyId)
      : null;
    try {
      const created = await this.prisma.major.create({
        data: {
          majorCode: dto.majorCode,
          majorName: dto.majorName,
          englishName: dto.englishName ?? null,
          degreeGroup: dto.degreeGroup ?? null,
          facultyId,
        },
        include: MAJOR_INCLUDE,
      });
      this.logger.log(`Major ${created.majorCode} created by ${access.userId}`);
      return toMajorDto(
        created,
        (await this.statsFor([created.id])).get(created.id),
      );
    } catch (error) {
      throw mapUniqueViolation(
        error,
        MAJOR_ERRORS.MAJOR_CODE_TAKEN,
        'majorCode',
      );
    }
  }

  async update(
    majorId: string,
    dto: UpdateMajorDto,
    access: AccessContext,
  ): Promise<MajorDto> {
    assertSchoolWideDirect(access, PERMISSIONS.PROGRAM_EDIT_INFO);
    const existing = await this.prisma.major.findUnique({
      where: { id: majorId },
      select: { id: true, majorCode: true },
    });
    if (!existing) throw new AppException(MAJOR_ERRORS.MAJOR_NOT_FOUND);
    const facultyId =
      dto.facultyId === undefined
        ? undefined
        : dto.facultyId === null
          ? null
          : await this.validateFaculty(dto.facultyId);
    const updated = await this.prisma.major.update({
      where: { id: majorId },
      data: {
        ...(dto.majorName !== undefined && { majorName: dto.majorName }),
        ...(dto.englishName !== undefined && { englishName: dto.englishName }),
        ...(dto.degreeGroup !== undefined && { degreeGroup: dto.degreeGroup }),
        ...(facultyId !== undefined && { facultyId }),
      },
      include: MAJOR_INCLUDE,
    });
    this.logger.log(`Major ${existing.majorCode} updated by ${access.userId}`);
    return toMajorDto(
      updated,
      (await this.statsFor([updated.id])).get(updated.id),
    );
  }

  async setStatus(
    majorId: string,
    status: MajorStatus,
    access: AccessContext,
  ): Promise<MajorDto> {
    assertSchoolWideDirect(access, PERMISSIONS.PROGRAM_EDIT_INFO);
    const existing = await this.prisma.major.findUnique({
      where: { id: majorId },
      select: { id: true, majorCode: true, status: true },
    });
    if (!existing) throw new AppException(MAJOR_ERRORS.MAJOR_NOT_FOUND);
    if (existing.status === status) {
      throw new AppException(MAJOR_ERRORS.STATUS_UNCHANGED);
    }
    const updated = await this.prisma.major.update({
      where: { id: majorId },
      data: { status },
      include: MAJOR_INCLUDE,
    });
    this.logger.log(
      `Major ${existing.majorCode} set ${status} by ${access.userId}`,
    );
    return toMajorDto(
      updated,
      (await this.statsFor([updated.id])).get(updated.id),
    );
  }

  /** Batched per-major stats (no N+1): 2 queries regardless of page size. */
  private async statsFor(majorIds: string[]): Promise<Map<string, MajorStats>> {
    const result = new Map<string, MajorStats>();
    if (majorIds.length === 0) return result;
    const [active, enrollments] = await Promise.all([
      this.prisma.program.groupBy({
        by: ['majorId'],
        where: { majorId: { in: majorIds }, status: ProgramStatus.ACTIVE },
        _count: { _all: true },
      }),
      this.prisma.programEnrollment.findMany({
        where: { program: { majorId: { in: majorIds } } },
        select: { studentId: true, program: { select: { majorId: true } } },
        distinct: ['studentId', 'programId'],
      }),
    ]);
    const students = new Map<string, Set<string>>();
    for (const e of enrollments) {
      const mid = e.program.majorId;
      if (!mid) continue;
      const set = students.get(mid) ?? new Set<string>();
      set.add(e.studentId);
      students.set(mid, set);
    }
    const activeBy = new Map(active.map((g) => [g.majorId, g._count._all]));
    for (const id of majorIds) {
      result.set(id, {
        activeProgramCount: activeBy.get(id) ?? 0,
        studentCount: students.get(id)?.size ?? 0,
      });
    }
    return result;
  }

  async overview(majorId: string): Promise<MajorOverviewDto> {
    const row = await this.prisma.major.findUnique({
      where: { id: majorId },
      include: MAJOR_INCLUDE,
    });
    if (!row) throw new AppException(MAJOR_ERRORS.MAJOR_NOT_FOUND);

    const today = new Date();
    const activeWindow = {
      revokedAt: null,
      validFrom: { lte: today },
      OR: [{ validTo: null }, { validTo: { gte: today } }],
    };

    const [programRows, enrollments, cohortLinks, groupRows] =
      await Promise.all([
        this.prisma.program.findMany({
          where: { majorId },
          orderBy: { programCode: 'asc' },
          select: {
            id: true,
            programCode: true,
            degreeLevel: true,
            status: true,
            faculty: { select: ORG_UNIT_REF_SELECT },
            directors: {
              where: activeWindow,
              select: {
                director: {
                  select: { id: true, userCode: true, fullName: true },
                },
              },
            },
            versions: {
              where: { sourceRequestId: null },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                versionNumber: true,
                status: true,
                programName: true,
                totalCredits: true,
                publishedAt: true,
                createdAt: true,
                _count: { select: { tracks: true, plos: true } },
              },
            },
          },
        }),
        this.prisma.programEnrollment.findMany({
          where: { program: { majorId } },
          select: {
            studentId: true,
            programId: true,
            cohortId: true,
            cohort: { select: { cohortCode: true } },
          },
          distinct: ['studentId', 'programId'],
        }),
        this.prisma.cohortVersion.findMany({
          where: { programVersion: { program: { majorId } } },
          select: {
            cohort: { select: { cohortCode: true } },
            programVersion: { select: { programId: true } },
          },
        }),
        row.facultyId
          ? this.prisma.subjectGroup.findMany({
              where: {
                facultyId: row.facultyId,
                status: SubjectGroupStatus.ACTIVE,
              },
              orderBy: { groupCode: 'asc' },
              select: {
                id: true,
                groupCode: true,
                groupName: true,
                status: true,
                members: { where: activeWindow, select: { id: true } },
                _count: {
                  select: {
                    ownedCourses: { where: { status: CourseStatus.ACTIVE } },
                  },
                },
              },
            })
          : Promise.resolve([]),
      ]);

    const reps = new Map<string, VersionLite | undefined>();
    for (const p of programRows) reps.set(p.id, pickRepresentative(p.versions));
    const repIds = [...reps.values()].flatMap((v) => (v ? [v.id] : []));

    const items = repIds.length
      ? await this.prisma.curriculumItem.findMany({
          where: { versionId: { in: repIds } },
          select: {
            versionId: true,
            course: {
              select: {
                id: true,
                courseCode: true,
                courseName: true,
                credits: true,
                courseType: true,
                ownerGroup: {
                  select: { id: true, groupCode: true, groupName: true },
                },
              },
            },
          },
        })
      : [];
    const courseIds = [...new Set(items.map((i) => i.course.id))];
    const syllabi = courseIds.length
      ? await this.prisma.syllabus.findMany({
          where: {
            courseId: { in: courseIds },
            status: SyllabusStatus.PUBLISHED,
            sourceRequestId: null,
          },
          select: { courseId: true },
          distinct: ['courseId'],
        })
      : [];
    const published = new Set(syllabi.map((s) => s.courseId));

    const versionCourses = new Map<string, Set<string>>();
    const courseMap = new Map<
      string,
      { course: (typeof items)[number]['course']; programs: Set<string> }
    >();
    const versionToProgram = new Map<string, string>();
    for (const [pid, v] of reps) if (v) versionToProgram.set(v.id, pid);
    for (const it of items) {
      const set = versionCourses.get(it.versionId) ?? new Set<string>();
      set.add(it.course.id);
      versionCourses.set(it.versionId, set);
      const entry = courseMap.get(it.course.id) ?? {
        course: it.course,
        programs: new Set<string>(),
      };
      const pid = versionToProgram.get(it.versionId);
      if (pid) entry.programs.add(pid);
      courseMap.set(it.course.id, entry);
    }

    const studentsByProgram = new Map<string, Set<string>>();
    const allStudents = new Set<string>();
    const cohortsByProgram = new Map<string, Set<string>>();
    const breakdown = new Map<
      string,
      {
        programId: string;
        cohortId: string;
        cohortCode: string;
        students: Set<string>;
      }
    >();
    for (const e of enrollments) {
      allStudents.add(e.studentId);
      const s = studentsByProgram.get(e.programId) ?? new Set<string>();
      s.add(e.studentId);
      studentsByProgram.set(e.programId, s);
      const c = cohortsByProgram.get(e.programId) ?? new Set<string>();
      c.add(e.cohort.cohortCode);
      cohortsByProgram.set(e.programId, c);
      const key = `${e.programId}|${e.cohortId}`;
      const b = breakdown.get(key) ?? {
        programId: e.programId,
        cohortId: e.cohortId,
        cohortCode: e.cohort.cohortCode,
        students: new Set<string>(),
      };
      b.students.add(e.studentId);
      breakdown.set(key, b);
    }
    for (const link of cohortLinks) {
      const pid = link.programVersion.programId;
      const c = cohortsByProgram.get(pid) ?? new Set<string>();
      c.add(link.cohort.cohortCode);
      cohortsByProgram.set(pid, c);
    }

    const programs: MajorOverviewProgramDto[] = programRows.map((p) => {
      const rep = reps.get(p.id);
      const released = p.versions.filter((v) =>
        RELEASED_STATUSES.includes(v.status),
      ).length;
      return {
        id: p.id,
        programCode: p.programCode,
        programName: rep?.programName ?? p.programCode,
        degreeLevel: p.degreeLevel,
        status: p.status,
        faculty: p.faculty,
        hasReleasedVersion: released > 0,
        directors: p.directors.map((d) => d.director),
        latestVersionId: rep?.id ?? null,
        latestVersionNumber: rep?.versionNumber ?? null,
        latestVersionStatus: rep?.status ?? null,
        totalCredits: rep ? Number(rep.totalCredits) : null,
        releasedVersionCount: released,
        trackCount: rep?._count.tracks ?? 0,
        ploCount: rep?._count.plos ?? 0,
        courseCount: rep ? (versionCourses.get(rep.id)?.size ?? 0) : 0,
        studentCount: studentsByProgram.get(p.id)?.size ?? 0,
        cohorts: [...(cohortsByProgram.get(p.id) ?? [])].sort(),
      };
    });

    const courses: MajorOverviewCourseDto[] = [...courseMap.values()]
      .map(({ course, programs: ps }) => ({
        id: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        credits: Number(course.credits),
        courseType: course.courseType,
        programCount: ps.size,
        hasPublishedSyllabus: published.has(course.id),
        ownerGroup: course.ownerGroup,
      }))
      .sort(
        (a, b) =>
          b.programCount - a.programCount ||
          a.courseCode.localeCompare(b.courseCode),
      );

    const subjectGroups: MajorOverviewSubjectGroupDto[] = groupRows.map(
      (g) => ({
        id: g.id,
        groupCode: g.groupCode,
        groupName: g.groupName,
        status: g.status,
        memberCount: g.members.length,
        courseCount: g._count.ownedCourses,
      }),
    );

    const programById = new Map(programs.map((p) => [p.id, p]));
    const cohortBreakdown: MajorOverviewCohortBreakdownDto[] = [
      ...breakdown.values(),
    ]
      .flatMap((b) => {
        const p = programById.get(b.programId);
        return p
          ? [
              {
                programId: p.id,
                programCode: p.programCode,
                programName: p.programName,
                cohortId: b.cohortId,
                cohortCode: b.cohortCode,
                studentCount: b.students.size,
              },
            ]
          : [];
      })
      .sort(
        (a, b) =>
          b.cohortCode.localeCompare(a.cohortCode) ||
          a.programCode.localeCompare(b.programCode),
      );

    const activeStatus = (p: MajorOverviewProgramDto): boolean =>
      p.status === ProgramStatus.ACTIVE;

    return {
      major: toMajorDto(row, {
        activeProgramCount: programs.filter(activeStatus).length,
        studentCount: allStudents.size,
      }),
      stats: {
        totalPrograms: programs.length,
        activePrograms: programs.filter(
          (p) => activeStatus(p) && p.hasReleasedVersion,
        ).length,
        draftPrograms: programs.filter(
          (p) => activeStatus(p) && !p.hasReleasedVersion,
        ).length,
        inactivePrograms: programs.filter(
          (p) => p.status === ProgramStatus.INACTIVE,
        ).length,
        releasedVersions: programs.reduce(
          (n, p) => n + p.releasedVersionCount,
          0,
        ),
        totalStudents: allStudents.size,
        totalCourses: courseMap.size,
        publishedSyllabi: courses.filter((c) => c.hasPublishedSyllabus).length,
        totalPlos: programs.reduce((n, p) => n + p.ploCount, 0),
        subjectGroupCount: subjectGroups.length,
      },
      programs,
      courses,
      subjectGroups,
      cohortBreakdown,
    };
  }

  private async validateFaculty(facultyId: string): Promise<string> {
    const unit = await this.prisma.orgUnit.findUnique({
      where: { id: facultyId },
      select: { id: true, unitType: true, status: true },
    });
    if (
      !unit ||
      unit.unitType !== OrgUnitType.FACULTY ||
      unit.status !== OrgUnitStatus.ACTIVE
    ) {
      throw new AppException(MAJOR_ERRORS.FACULTY_INVALID);
    }
    return unit.id;
  }
}
