import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProgramVersionStatus } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { assertSchoolWideDirect } from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { lockSemester } from '../../shared/releases/release-locks.js';
import {
  CohortDto,
  SemesterDto,
  toCohortDto,
  toSemesterDto,
} from '../../shared/releases/semester.dto.js';
import { VersionActivator } from '../../shared/releases/version.activator.js';
import { fromIsoDay, toIsoDay, todayDate } from '../../shared/time/today.js';
import { CreateCohortDto, UpdateCohortDto } from './dto/cohort.dto.js';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semester.dto.js';
import { SEMESTER_ERRORS } from './semesters.errors.js';

// MH-10: the terms and intakes a release names. A start date that a released version already stands on never moves.
@Injectable()
export class SemestersService {
  private readonly logger = new Logger(SemestersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activator: VersionActivator,
  ) {}

  async listSemesters(): Promise<SemesterDto[]> {
    const rows = await this.prisma.semester.findMany({
      orderBy: [{ academicYear: 'desc' }, { termInYear: 'asc' }],
    });
    return rows.map(toSemesterDto);
  }

  async listCohorts(): Promise<CohortDto[]> {
    const rows = await this.prisma.cohort.findMany({
      orderBy: [{ intakeYear: 'desc' }, { cohortCode: 'asc' }],
    });
    return rows.map(toCohortDto);
  }

  async createSemester(
    dto: CreateSemesterDto,
    access: AccessContext,
  ): Promise<SemesterDto> {
    assertSchoolWideDirect(access, PERMISSIONS.SEMESTER_MANAGE);
    try {
      const row = await this.prisma.semester.create({
        data: {
          semesterCode: dto.semesterCode,
          academicYear: dto.academicYear,
          termInYear: dto.termInYear,
          startDate: dto.startDate ? fromIsoDay(dto.startDate) : null,
        },
      });
      this.logger.log(
        `Semester ${row.semesterCode} created by ${access.userId}`,
      );
      return toSemesterDto(row);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        SEMESTER_ERRORS.SEMESTER_EXISTS,
        'semesterCode',
      );
    }
  }

  // The semester row is locked, so a concurrent activation reads the date this update leaves behind.
  // A Pending version whose semester now has begun is activated at once instead of waiting for the daily job.
  async updateSemester(
    id: string,
    dto: UpdateSemesterDto,
    access: AccessContext,
  ): Promise<SemesterDto> {
    assertSchoolWideDirect(access, PERMISSIONS.SEMESTER_MANAGE);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await lockSemester(tx, id);
        const current = await tx.semester.findUnique({ where: { id } });
        if (!current)
          throw new AppException(SEMESTER_ERRORS.SEMESTER_NOT_FOUND);
        if (
          dto.startDate !== undefined &&
          (dto.startDate ?? null) !== dayOrNull(current.startDate)
        ) {
          const standing = await tx.programVersion.count({
            where: {
              effectiveSemesterId: id,
              status: {
                in: [
                  ProgramVersionStatus.ACTIVE,
                  ProgramVersionStatus.HISTORICAL,
                ],
              },
            },
          });
          const enrollmentCount = await tx.programEnrollment.count({
            where: {
              OR: [{ fromSemesterId: id }, { untilSemesterId: id }],
            },
          });
          if (standing > 0 || enrollmentCount > 0)
            throw new AppException(SEMESTER_ERRORS.SEMESTER_IN_USE);
        }
        const updated = await tx.semester.update({
          where: { id },
          data: semesterData(dto),
        });
        await this.activateDue(tx, updated.id);
        return updated;
      });
      return toSemesterDto(row);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        SEMESTER_ERRORS.SEMESTER_EXISTS,
        'semesterCode',
      );
    }
  }

  async createCohort(
    dto: CreateCohortDto,
    access: AccessContext,
  ): Promise<CohortDto> {
    assertSchoolWideDirect(access, PERMISSIONS.SEMESTER_MANAGE);
    try {
      return toCohortDto(await this.prisma.cohort.create({ data: dto }));
    } catch (error) {
      throw mapUniqueViolation(
        error,
        SEMESTER_ERRORS.COHORT_EXISTS,
        'cohortCode',
      );
    }
  }

  async updateCohort(
    id: string,
    dto: UpdateCohortDto,
    access: AccessContext,
  ): Promise<CohortDto> {
    assertSchoolWideDirect(access, PERMISSIONS.SEMESTER_MANAGE);
    try {
      return toCohortDto(
        await this.prisma.cohort.update({ where: { id }, data: dto }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new AppException(SEMESTER_ERRORS.COHORT_NOT_FOUND);
      }
      throw mapUniqueViolation(
        error,
        SEMESTER_ERRORS.COHORT_EXISTS,
        'cohortCode',
      );
    }
  }

  private async activateDue(
    tx: Prisma.TransactionClient,
    semesterId: string,
  ): Promise<void> {
    const due = await tx.programVersion.findMany({
      where: {
        effectiveSemesterId: semesterId,
        status: ProgramVersionStatus.PENDING,
        effectiveSemester: { startDate: { lte: todayDate() } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    for (const version of due) await this.activator.activate(tx, version.id);
  }
}

const dayOrNull = (date: Date | null) => (date ? toIsoDay(date) : null);

function semesterData(
  dto: Partial<CreateSemesterDto>,
): Prisma.SemesterUpdateInput {
  return {
    semesterCode: dto.semesterCode,
    academicYear: dto.academicYear,
    termInYear: dto.termInYear,
    startDate:
      dto.startDate === undefined
        ? undefined
        : dto.startDate === null
          ? null
          : fromIsoDay(dto.startDate),
  };
}
