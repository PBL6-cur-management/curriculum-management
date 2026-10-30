import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { graduationStaffScope } from '../../shared/graduation/graduation-access.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import { requireSemesterStart } from '../../shared/releases/semester-start.js';
import { enrollmentCoversWhere } from '../../shared/students/enrollment-period.js';
import type { GraduationStudentOptionsQueryDto } from './graduation-options.dto.js';

function selectorScope(access: AccessContext) {
  const held: ReturnType<typeof graduationStaffScope>[] = [];
  for (const write of [false, true]) {
    try {
      held.push(graduationStaffScope(access, write));
    } catch (error) {
      if (!(error instanceof AppException) || error.getStatus() !== 403)
        throw error;
    }
  }
  if (!held.length) return graduationStaffScope(access);
  if (held.some((scope) => scope.all)) return { all: true } as const;
  return {
    all: false,
    programIds: [
      ...new Set(held.flatMap((scope) => (scope.all ? [] : scope.programIds))),
    ],
  } as const;
}

@Injectable()
export class GraduationOptionsService {
  constructor(private readonly prisma: PrismaService) {}
  async programs(access: AccessContext, semesterId: string) {
    const scope = selectorScope(access);
    return this.prisma.$transaction(
      async (tx) => {
        const semester = await requireSemesterStart(tx, semesterId);
        const rows = await tx.program.findMany({
          where: {
            ...(scope.all ? {} : { id: { in: [...scope.programIds] } }),
            enrollments: { some: enrollmentCoversWhere(semester) },
          },
          select: {
            id: true,
            programCode: true,
            versions: {
              where: { status: { not: 'DRAFT' } },
              orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: { programName: true },
            },
          },
          orderBy: [{ programCode: 'asc' }, { id: 'asc' }],
        });
        return rows.map((row) => ({
          id: row.id,
          programCode: row.programCode,
          programName: row.versions[0]?.programName ?? row.programCode,
        }));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async students(
    access: AccessContext,
    query: GraduationStudentOptionsQueryDto,
  ) {
    const scope = selectorScope(access);
    if (!scope.all && !scope.programIds.includes(query.programId))
      throw new AppException(GRADUATION_ERRORS.ACCESS_REVOKED);
    return this.prisma.$transaction(
      async (tx) => {
        const semester = await requireSemesterStart(tx, query.semesterId);
        const enrollmentWhere = {
          ...enrollmentCoversWhere(semester),
          programId: query.programId,
        };
        const search = query.q?.trim();
        const where: Prisma.StudentWhereInput = {
          enrollments: { some: enrollmentWhere },
          ...(search
            ? {
                OR: [
                  { studentCode: { contains: search, mode: 'insensitive' } },
                  { fullName: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
        const [rows, total] = await Promise.all([
          tx.student.findMany({
            where,
            select: {
              id: true,
              studentCode: true,
              fullName: true,
              enrollments: {
                where: enrollmentWhere,
                select: {
                  id: true,
                  cohortId: true,
                  cohort: { select: { cohortCode: true } },
                },
                orderBy: { id: 'asc' },
              },
            },
            orderBy: [{ studentCode: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.student.count({ where }),
        ]);
        return {
          items: rows.map((student) => {
            const enrollment = student.enrollments[0];
            if (
              !enrollment ||
              new Set(student.enrollments.map((row) => row.cohortId)).size !== 1
            )
              throw new AppException(GRADUATION_ERRORS.ENROLLMENT_AMBIGUOUS);
            return {
              id: student.id,
              studentCode: student.studentCode,
              fullName: student.fullName,
              enrollmentId:
                student.enrollments.length === 1 ? enrollment.id : null,
              cohortId: enrollment.cohortId,
              cohortCode: enrollment.cohort.cohortCode,
            };
          }),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
