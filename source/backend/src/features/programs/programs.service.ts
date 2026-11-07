import { Injectable, Logger } from '@nestjs/common';
import {
  OrgUnitStatus,
  OrgUnitType,
  type Prisma,
  ProgramStatus,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import {
  assertDirectEdit,
  assertSchoolWideDirect,
  editPathFor,
} from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import { HOME_FACULTY_CODE } from '../../shared/org-units/home-faculty.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import {
  programEditState,
  programTarget,
} from '../../shared/programs/program-target.js';
import { todayDate } from '../../shared/time/today.js';
import { CurriculumFactsReader } from '../../shared/curriculum/curriculum-facts.reader.js';
import { assertCreditsAddUp } from './credits-check.js';
import { assertSemestersCoverCurriculum } from './semester-check.js';
import { versionData } from './version-data.js';
import { CreateProgramDto } from './create-program.dto.js';
import {
  draftVersion,
  programInclude,
  toProgramDetailDto,
  toProgramSummaryDto,
  type ProgramDetailDto,
  type ProgramRow,
  type ProgramSummaryDto,
} from './program.dto.js';
import { ProgramQueryDto } from './program-query.dto.js';
import { findProgramOrThrow } from './program-reader.js';
import { RELEASED_STATUSES, releaseYearWhere } from './program-release-year.js';
import { PROGRAM_CONSTRAINT, PROGRAM_ERRORS } from './programs.errors.js';
import { UpdateProgramDto } from './update-program.dto.js';

// Both year filters must hold on the same released version, so a cohort is matched to the year it was released in.
function releasedVersionWhere(
  query: ProgramQueryDto,
): Prisma.ProgramWhereInput {
  const { releaseYear, intakeYear } = query;
  if (releaseYear === undefined && intakeYear === undefined) {
    return {};
  }
  const conditions: Prisma.ProgramVersionWhereInput[] = [];
  if (releaseYear !== undefined) {
    conditions.push(releaseYearWhere(releaseYear));
  }
  if (intakeYear !== undefined) {
    conditions.push({ cohortVersions: { some: { cohort: { intakeYear } } } });
  }
  return {
    versions: {
      some: {
        sourceRequestId: null,
        status: { in: [...RELEASED_STATUSES] },
        AND: conditions,
      },
    },
  };
}

@Injectable()
export class ProgramsService {
  private readonly logger = new Logger(ProgramsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumFacts: CurriculumFactsReader,
  ) {}

  async list(
    query: ProgramQueryDto,
    access: AccessContext,
  ): Promise<Page<ProgramSummaryDto>> {
    // A student holds program.view only for their own program, so the school-wide list is refused (US-018 AC3).
    if (!access.scopeFor(PERMISSIONS.PROGRAM_VIEW).all) {
      throw new AppException(COMMON_ERRORS.PERMISSION_DENIED);
    }
    const where: Prisma.ProgramWhereInput = {
      ...(query.degreeLevel && { degreeLevel: query.degreeLevel }),
      ...(query.status && { status: query.status }),
      ...(query.facultyId && { facultyId: query.facultyId }),
      ...releasedVersionWhere(query),
      ...(query.q && {
        OR: [
          { programCode: { contains: query.q, mode: 'insensitive' } },
          {
            versions: {
              some: {
                programName: { contains: query.q, mode: 'insensitive' },
              },
            },
          },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.program.findMany({
        where,
        include: programInclude(todayDate()),
        orderBy: { programCode: 'asc' },
        ...toSkipTake(query),
      }),
      this.prisma.program.count({ where }),
    ]);
    return toPage(rows.map(toProgramSummaryDto), total, query);
  }

  async detail(
    programId: string,
    access: AccessContext,
  ): Promise<ProgramDetailDto> {
    const row = await this.findOrThrow(programId);
    access.assertCan(PERMISSIONS.PROGRAM_VIEW, programTarget(row));
    return this.toDetail(row, access);
  }

  async create(
    dto: CreateProgramDto,
    access: AccessContext,
  ): Promise<ProgramDetailDto> {
    assertSchoolWideDirect(access, PERMISSIONS.PROGRAM_EDIT_INFO);
    assertCreditsAddUp(dto);
    const facultyId = await this.resolveFaculty(dto.facultyId);
    try {
      const program = await this.prisma.program.create({
        data: {
          programCode: dto.programCode,
          facultyId,
          degreeLevel: dto.degreeLevel,
          versions: {
            create: {
              programName: dto.programName,
              majorCode: dto.majorCode,
              majorName: dto.majorName,
              semesterCount: dto.semesterCount,
              totalCredits: dto.totalCredits,
              compulsoryCredits: dto.compulsoryCredits,
              electiveCredits: dto.electiveCredits,
            },
          },
        },
        select: { id: true },
      });
      this.logger.log(`Program ${dto.programCode} created by ${access.userId}`);
      return await this.toDetail(await this.findOrThrow(program.id), access);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        PROGRAM_ERRORS.PROGRAM_CODE_TAKEN,
        'programCode',
      );
    }
  }

  // Info lives on the Draft version (M-3); with no Draft the program has been released and only a request can change it.
  async update(
    programId: string,
    dto: UpdateProgramDto,
    access: AccessContext,
  ): Promise<ProgramDetailDto> {
    const row = await this.findOrThrow(programId);
    assertDirectEdit(
      access,
      PERMISSIONS.PROGRAM_EDIT_INFO,
      programTarget(row),
      await programEditState(this.prisma, row.id),
    );
    const draft = draftVersion(row);
    if (!draft) {
      throw new AppException(COMMON_ERRORS.CHANGE_REQUEST_REQUIRED);
    }
    const { degreeLevel, ...fields } = dto;
    await assertSemestersCoverCurriculum(
      this.curriculumFacts,
      draft.id,
      fields.semesterCount,
    );
    assertCreditsAddUp({
      totalCredits: fields.totalCredits ?? draft.totalCredits.toString(),
      compulsoryCredits:
        fields.compulsoryCredits ?? draft.compulsoryCredits.toString(),
      electiveCredits:
        fields.electiveCredits ?? draft.electiveCredits.toString(),
    });
    await this.prisma.$transaction([
      this.prisma.programVersion.update({
        where: { id: draft.id },
        data: versionData(fields),
      }),
      ...(degreeLevel
        ? [
            this.prisma.program.update({
              where: { id: row.id },
              data: { degreeLevel },
            }),
          ]
        : []),
    ]);
    this.logger.log(
      `Program ${row.programCode} draft info updated by ${access.userId}`,
    );
    return this.toDetail(await this.findOrThrow(row.id), access);
  }

  // Deactivate and reactivate are R1 actions on the program itself, not version content (D10).
  async setStatus(
    programId: string,
    status: ProgramStatus,
    access: AccessContext,
  ): Promise<ProgramDetailDto> {
    assertSchoolWideDirect(access, PERMISSIONS.PROGRAM_EDIT_INFO);
    const row = await this.findOrThrow(programId);
    if (row.status === status) {
      throw new AppException(PROGRAM_ERRORS.STATUS_UNCHANGED);
    }
    await this.prisma.program.update({
      where: { id: row.id },
      data: { status },
    });
    this.logger.log(
      `Program ${row.programCode} set ${status} by ${access.userId}`,
    );
    return this.toDetail(await this.findOrThrow(row.id), access);
  }

  private async toDetail(
    row: ProgramRow,
    access: AccessContext,
  ): Promise<ProgramDetailDto> {
    const state = await programEditState(this.prisma, row.id);
    return toProgramDetailDto(row, {
      editPath: editPathFor(
        access,
        PERMISSIONS.PROGRAM_EDIT_INFO,
        programTarget(row),
        state,
      ),
      canManage: access.modeFor(PERMISSIONS.DIRECTOR_ASSIGN, {}) === 'DIRECT',
      canClone: access.modeFor(PERMISSIONS.PROGRAM_CLONE, {}) === 'DIRECT',
    });
  }

  // The detail the caller sees after a write by a sibling service; the caller's own permission was checked there.
  async detailOf(
    programId: string,
    access: AccessContext,
  ): Promise<ProgramDetailDto> {
    return this.toDetail(await this.findOrThrow(programId), access);
  }

  private findOrThrow(programId: string): Promise<ProgramRow> {
    return findProgramOrThrow(this.prisma, programId);
  }

  // The faculty must be an active FACULTY unit; omitted means the home faculty.
  private async resolveFaculty(facultyId: string | undefined): Promise<string> {
    const faculty = await this.prisma.orgUnit.findUnique({
      where: facultyId ? { id: facultyId } : { unitCode: HOME_FACULTY_CODE },
      select: { id: true, unitType: true, status: true },
    });
    if (
      !faculty ||
      faculty.unitType !== OrgUnitType.FACULTY ||
      faculty.status !== OrgUnitStatus.ACTIVE
    ) {
      throw new AppException(PROGRAM_ERRORS.FACULTY_INVALID, [
        {
          field: 'facultyId',
          constraints: [PROGRAM_CONSTRAINT.ACTIVE_FACULTY],
        },
      ]);
    }
    return faculty.id;
  }
}
