import { Injectable } from '@nestjs/common';
import { Prisma, ProgramVersionStatus } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  requireSemesterStart,
  type StartedSemester,
} from '../../shared/releases/semester-start.js';
import { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import { enrollmentCoversWhere } from '../../shared/students/enrollment-period.js';
import {
  assertStudentEnrollmentWrite,
  assertStudentProgramRead,
  holdsStudentEnrollmentWrite,
  staffStudentScope,
  type StaffStudentScope,
} from '../../shared/students/student-access.js';
import { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { STUDENT_ERRORS } from '../../shared/students/student.errors.js';
import type { AcademicResultPageDto } from './dto/academic-result.dto.js';
import type {
  StudentAppliedVersionDto,
  StudentDetailDto,
  StudentEnrollmentTargetDto,
  StudentEnrollmentWarningDto,
  StudentSummaryDto,
  StudentProgramOptionDto,
} from './dto/student.dto.js';
import type {
  StudentContextQueryDto,
  StudentDetailQueryDto,
  StudentListQueryDto,
  StudentResultsQueryDto,
  StudentOptionalSemesterQueryDto,
} from './dto/student-query.dto.js';
import {
  ENROLLMENT_INCLUDE,
  RESULT_INCLUDE,
  STUDENT_DETAIL_INCLUDE,
  STUDENT_SUMMARY_INCLUDE,
  toAcademicResultDto,
  toAppliedVersionDto,
  toEnrollmentDto,
  toEnrollmentTargetDto,
  toProgramOptionDto,
  toStudentDetailDto,
  toStudentSummaryDto,
} from './students.mapper.js';

const REPEATABLE_READ = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
} as const;

const WARNING_CODES = {
  NO_ENROLLMENT: 'NO_ENROLLMENT',
  RECONCILIATION_PENDING: 'RECONCILIATION_PENDING',
} as const;
const RESOLUTION_WARNINGS: ReadonlySet<string> = new Set([
  STUDENT_ERRORS.ENROLLMENT_NOT_FOUND.code,
  STUDENT_ERRORS.ENROLLMENT_AMBIGUOUS.code,
  STUDENT_ERRORS.APPLIED_VERSION_UNRESOLVED.code,
]);
const NO_ENROLLMENT_MESSAGE =
  'Sinh viên chưa có quá trình theo học nào; cần gán phiên bản chương trình.';
const RECONCILIATION_PENDING_MESSAGE =
  'Phiên bản đang áp dụng theo khóa khác với quá trình theo học đã lưu; chạy đối soát để cập nhật.';

// Every read is a snapshot: count and rows come from one transaction and one predicate, and nothing here writes.
@Injectable()
export class StudentsReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appliedVersions: StudentAppliedVersionReader,
    private readonly results: AcademicResultsReader,
  ) {}

  async programOptions(
    access: AccessContext,
    query: StudentOptionalSemesterQueryDto,
  ): Promise<StudentProgramOptionDto[]> {
    const scope = staffStudentScope(access);
    return this.prisma.$transaction(async (tx) => {
      if (query.semesterId) await requireSemesterStart(tx, query.semesterId);
      const rows = await tx.program.findMany({
        where: {
          ...(scope.all ? {} : { id: { in: [...scope.programIds] } }),
        },
        select: {
          id: true,
          programCode: true,
          versions: {
            where: { status: { not: ProgramVersionStatus.DRAFT } },
            orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { programName: true },
          },
        },
        orderBy: [{ programCode: 'asc' }, { id: 'asc' }],
      });
      return rows.map((row) =>
        toProgramOptionDto(
          row.id,
          row.programCode,
          row.versions[0]?.programName ?? row.programCode,
        ),
      );
    }, REPEATABLE_READ);
  }

  async list(
    access: AccessContext,
    query: StudentListQueryDto,
  ): Promise<Page<StudentSummaryDto>> {
    const scope = staffStudentScope(access);
    return this.prisma.$transaction(async (tx) => {
      const semester = query.semesterId
        ? await requireSemesterStart(tx, query.semesterId)
        : null;
      const where = this.listWhere(scope, semester, query);
      const [rows, total] = await Promise.all([
        tx.student.findMany({
          where,
          include: STUDENT_SUMMARY_INCLUDE,
          orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
          ...toSkipTake(query),
        }),
        tx.student.count({ where }),
      ]);
      return toPage(rows.map(toStudentSummaryDto), total, query);
    }, REPEATABLE_READ);
  }

  async detail(
    access: AccessContext,
    studentId: string,
    query: StudentDetailQueryDto,
  ): Promise<StudentDetailDto> {
    const scope = staffStudentScope(access);
    if (!scope.all && !query.programId) {
      throw new AppException(STUDENT_ERRORS.PROGRAM_CONTEXT_REQUIRED);
    }
    return this.prisma.$transaction(async (tx) => {
      const semester = await requireSemesterStart(tx, query.semesterId);
      const student = await tx.student.findFirst({
        where: {
          id: studentId,
          ...this.listWhere(scope, semester, { programId: query.programId }),
        },
        include: STUDENT_DETAIL_INCLUDE,
      });
      if (!student) throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
      if (query.programId) {
        assertStudentProgramRead(access, 'PROGRESS', student, query.programId);
      }
      const enrollments = await tx.programEnrollment.findMany({
        where: {
          studentId,
          ...(scope.all ? {} : { programId: { in: [...scope.programIds] } }),
        },
        include: ENROLLMENT_INCLUDE,
        orderBy: [
          { fromSemester: { startDate: 'asc' } },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      });
      return toStudentDetailDto(student, {
        enrollments: enrollments.map(toEnrollmentDto),
        canManageEnrollments: holdsStudentEnrollmentWrite(access),
        enrollmentWarnings: await this.warnings(
          tx,
          access,
          studentId,
          query,
          enrollments,
        ),
      });
    }, REPEATABLE_READ);
  }

  async listResults(
    access: AccessContext,
    studentId: string,
    query: StudentResultsQueryDto,
  ): Promise<AcademicResultPageDto> {
    return this.prisma.$transaction(async (tx) => {
      const { semester } = await this.results.authorizeRead(
        tx,
        access,
        'PROGRESS',
        { studentId, programId: query.programId, semesterId: query.semesterId },
      );
      const where: Prisma.AcademicResultWhereInput = {
        studentId,
        semester: { startDate: { lte: semester.startDate } },
        ...(query.resultSemesterId
          ? { semesterId: query.resultSemesterId }
          : {}),
        ...(query.courseId ? { courseId: query.courseId } : {}),
      };
      const [rows, total] = await Promise.all([
        tx.academicResult.findMany({
          where,
          include: RESULT_INCLUDE,
          orderBy: [
            { semester: { startDate: 'desc' } },
            { course: { courseCode: 'asc' } },
            { id: 'asc' },
          ],
          ...toSkipTake(query),
        }),
        tx.academicResult.count({ where }),
      ]);
      return toPage(rows.map(toAcademicResultDto), total, query);
    }, REPEATABLE_READ);
  }

  async appliedVersion(
    access: AccessContext,
    studentId: string,
    query: StudentContextQueryDto,
  ): Promise<StudentAppliedVersionDto> {
    const result = await this.appliedVersions
      .forAccess(access, 'PROGRESS')
      .resolveForStudent({
        studentId,
        programId: query.programId,
        semesterId: query.semesterId,
      });
    return toAppliedVersionDto(result);
  }

  // Versions the enrollment command would accept: issued, and effective no later than the chosen start semester.
  async enrollmentTargets(
    access: AccessContext,
    studentId: string,
    query: StudentContextQueryDto,
  ): Promise<StudentEnrollmentTargetDto[]> {
    assertStudentEnrollmentWrite(access);
    return this.prisma.$transaction(async (tx) => {
      const semester = await requireSemesterStart(tx, query.semesterId);
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { id: true },
      });
      if (!student) throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
      const versions = await tx.programVersion.findMany({
        where: {
          programId: query.programId,
          status: { not: ProgramVersionStatus.DRAFT },
          sourceRequestId: null,
          versionNumber: { not: null },
          publishedAt: { not: null },
          effectiveSemester: { startDate: { lte: semester.startDate } },
        },
        include: {
          program: { select: { programCode: true } },
          effectiveSemester: true,
        },
        orderBy: [{ effectiveSemester: { startDate: 'desc' } }, { id: 'asc' }],
      });
      return versions.map((version) =>
        toEnrollmentTargetDto({
          ...version,
          effectiveSemester: version.effectiveSemester!,
        }),
      );
    }, REPEATABLE_READ);
  }

  // R1 sees every student when no program is named; a named program, and every R3 query, requires an enrollment in it
  // that covers the semester, or any enrollment in it when no semester is chosen.
  private listWhere(
    scope: StaffStudentScope,
    semester: StartedSemester | null,
    filters: {
      programId?: string;
      cohortId?: string;
      q?: string;
      status?: StudentListQueryDto['status'];
    },
  ): Prisma.StudentWhereInput {
    const programIds = scope.all ? undefined : [...scope.programIds];
    const covering: Prisma.ProgramEnrollmentWhereInput = {
      ...(semester ? enrollmentCoversWhere(semester) : {}),
      ...(programIds ? { programId: { in: programIds } } : {}),
      ...(filters.programId ? { programId: filters.programId } : {}),
    };
    const enrolled = !!programIds || !!filters.programId;
    // A named program narrows the director's set instead of replacing it.
    const directed =
      programIds && filters.programId && !programIds.includes(filters.programId)
        ? { id: { in: [] as string[] } }
        : null;
    return {
      ...(directed ?? {}),
      ...(enrolled ? { enrollments: { some: covering } } : {}),
      ...(filters.cohortId ? { cohortId: filters.cohortId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { studentCode: { contains: filters.q, mode: 'insensitive' } },
              { fullName: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async warnings(
    tx: Prisma.TransactionClient,
    access: AccessContext,
    studentId: string,
    query: StudentDetailQueryDto,
    enrollments: readonly { id: string; appliedVersion: { id: string } }[],
  ): Promise<StudentEnrollmentWarningDto[]> {
    const warnings: StudentEnrollmentWarningDto[] = [];
    if (enrollments.length === 0) {
      warnings.push({
        code: WARNING_CODES.NO_ENROLLMENT,
        message: NO_ENROLLMENT_MESSAGE,
        enrollmentId: null,
      });
    }
    if (!query.programId) return warnings;
    try {
      const [resolved] = await this.appliedVersions.resolveManyForAccess(
        access,
        'PROGRESS',
        [
          {
            studentId,
            programId: query.programId,
            semesterId: query.semesterId,
          },
        ],
        tx,
      );
      const stored = enrollments.find(
        (row) => row.id === resolved!.enrollmentId,
      );
      if (stored && stored.appliedVersion.id !== resolved!.programVersionId) {
        warnings.push({
          code: WARNING_CODES.RECONCILIATION_PENDING,
          message: RECONCILIATION_PENDING_MESSAGE,
          enrollmentId: stored.id,
        });
      }
    } catch (error) {
      if (
        error instanceof AppException &&
        RESOLUTION_WARNINGS.has(error.code)
      ) {
        warnings.push({
          code: error.code,
          message: error.message,
          enrollmentId: null,
        });
      } else {
        throw error;
      }
    }
    return warnings;
  }
}
