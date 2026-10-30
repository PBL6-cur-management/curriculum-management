import { createHash } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { assertGraduationWrite } from '../../shared/graduation/graduation-access.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import { requireSemesterStart } from '../../shared/releases/semester-start.js';
import { staffStudentScope } from '../../shared/students/student-access.js';
import { hasKnownEnrollmentBoundaries } from '../../shared/students/enrollment-period.js';
import { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import type { StudentAppliedVersionResult } from '../../shared/students/student-applied-version.types.js';
import type { GraduationBatchFilterDto } from './graduation-batch.dto.js';

export interface GraduationRosterItem {
  studentId: string;
  programId: string;
  semesterId: string;
  rosterEnrollmentId: string | null;
  rosterIdentity: Prisma.InputJsonObject;
}

@Injectable()
export class GraduationRosterReader {
  constructor(private readonly versions: StudentAppliedVersionReader) {}

  async read(
    access: AccessContext,
    filters: GraduationBatchFilterDto,
    tx: Prisma.TransactionClient,
  ) {
    if (!filters.programId && !filters.cohortId)
      throw new BadRequestException('Chọn ít nhất một chương trình hoặc khóa.');
    const scope = staffStudentScope(access, 'GRADUATION');
    if (!scope.all && !filters.programId)
      throw new AppException(GRADUATION_ERRORS.ACCESS_REVOKED);
    if (filters.programId)
      assertGraduationWrite(access, { programIds: [filters.programId] });
    const semester = await requireSemesterStart(tx, filters.semesterId);
    const rows = await tx.programEnrollment.findMany({
      where: {
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(filters.cohortId ? { cohortId: filters.cohortId } : {}),
        AND: [
          {
            OR: [
              { fromSemester: { startDate: { lte: semester.startDate } } },
              { fromSemester: { startDate: null } },
            ],
          },
          {
            OR: [
              { untilSemesterId: null },
              { untilSemester: { startDate: { gt: semester.startDate } } },
              { untilSemester: { startDate: null } },
            ],
          },
        ],
      },
      include: {
        student: true,
        program: true,
        cohort: true,
        fromSemester: true,
        untilSemester: true,
        appliedVersion: { select: { programName: true } },
      },
      orderBy: [
        { student: { studentCode: 'asc' } },
        { program: { programCode: 'asc' } },
        { id: 'asc' },
      ],
    });
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      assertGraduationWrite(access, {
        programIds: [row.programId],
        studentIds: [row.studentId],
      });
      const key = JSON.stringify([row.studentId, row.programId]);
      const group = grouped.get(key) ?? [];
      group.push(row);
      grouped.set(key, group);
    }
    const groups = [...grouped.values()];
    const resolutions = new Map<
      string,
      StudentAppliedVersionResult | { code: string; message: string }
    >();
    const uniqueGroups = groups.filter(
      (group) =>
        group.length === 1 &&
        hasKnownEnrollmentBoundaries({
          fromStart: group[0]!.fromSemester.startDate,
          untilSemester: group[0]!.untilSemester,
        }),
    );
    for (
      let offset = 0;
      offset < uniqueGroups.length;
      offset += GRADUATION_LIMITS.BATCH_CHUNK_SIZE
    ) {
      const inputs = uniqueGroups
        .slice(offset, offset + GRADUATION_LIMITS.BATCH_CHUNK_SIZE)
        .map(([row]) => ({
          studentId: row!.studentId,
          programId: row!.programId,
          semesterId: semester.id,
        }));
      try {
        for (const result of await this.versions.resolveManyForAccess(
          access,
          'GRADUATION',
          inputs,
          tx,
        ))
          resolutions.set(
            JSON.stringify([result.studentId, result.programId]),
            result,
          );
      } catch (error) {
        if (!(error instanceof AppException)) throw error;
        for (const input of inputs) {
          try {
            const result = await this.versions
              .forAccess(access, 'GRADUATION')
              .resolveForStudent(input, tx);
            resolutions.set(
              JSON.stringify([input.studentId, input.programId]),
              result,
            );
          } catch (failure) {
            if (
              !(failure instanceof AppException) ||
              failure.getStatus() >= 500
            )
              throw failure;
            resolutions.set(
              JSON.stringify([input.studentId, input.programId]),
              { code: failure.code, message: failure.message },
            );
          }
        }
      }
    }
    const resolvedIds = [...resolutions.values()].flatMap((value) =>
      'programVersionId' in value ? [value.programVersionId] : [],
    );
    const versionNames = new Map(
      (
        await tx.programVersion.findMany({
          where: { id: { in: resolvedIds } },
          select: { id: true, programName: true },
        })
      ).map((version) => [version.id, version.programName]),
    );
    const canonicalFilters = {
      semesterId: filters.semesterId,
      programId: filters.programId ?? null,
      cohortId: filters.cohortId ?? null,
    };
    const items: GraduationRosterItem[] = groups.map((group) => {
      const row = group[0]!;
      const invalid = group.some(
        (entry) =>
          !hasKnownEnrollmentBoundaries({
            fromStart: entry.fromSemester.startDate,
            untilSemester: entry.untilSemester,
          }),
      );
      const resolution = resolutions.get(
        JSON.stringify([row.studentId, row.programId]),
      );
      const diagnostic = invalid
        ? {
            code: 'INVALID_ENROLLMENT_INTERVAL',
            message:
              'Khoảng theo học thiếu ngày học kỳ; cần kiểm tra trước khi xét.',
          }
        : group.length > 1
          ? GRADUATION_ERRORS.ENROLLMENT_AMBIGUOUS
          : resolution && 'code' in resolution
            ? resolution
            : null;
      return {
        studentId: row.studentId,
        programId: row.programId,
        semesterId: semester.id,
        rosterEnrollmentId: group.length === 1 && !invalid ? row.id : null,
        rosterIdentity: {
          studentCode: row.student.studentCode,
          fullName: row.student.fullName,
          programCode: row.program.programCode,
          programName:
            resolution && 'programVersionId' in resolution
              ? (versionNames.get(resolution.programVersionId) ??
                row.appliedVersion.programName)
              : row.appliedVersion.programName,
          semesterCode: semester.semesterCode,
          cohortId: row.cohortId,
          cohortCode: row.cohort.cohortCode,
          rosterDiagnostic: diagnostic
            ? { code: diagnostic.code, message: diagnostic.message }
            : null,
          enrollmentFacts: group.map((entry) => ({
            id: entry.id,
            updatedAt: entry.updatedAt.toISOString(),
            cohortId: entry.cohortId,
            fromSemesterId: entry.fromSemesterId,
            fromStart: entry.fromSemester.startDate?.toISOString() ?? null,
            untilSemesterId: entry.untilSemesterId,
            untilStart: entry.untilSemester?.startDate?.toISOString() ?? null,
            appliedVersionId: entry.appliedVersionId,
            admissionVersionId: entry.admissionVersionId,
            isException: entry.isException,
            basisDecision: entry.basisDecision,
          })),
          resolvedVersionId:
            resolution && 'programVersionId' in resolution
              ? resolution.programVersionId
              : null,
          cohortAssignmentId:
            resolution && 'cohortAssignmentId' in resolution
              ? resolution.cohortAssignmentId
              : null,
        },
      };
    });
    const revision = createHash('sha256')
      .update(
        JSON.stringify({
          filters: canonicalFilters,
          semesterStart: semester.startDate.toISOString(),
          items,
        }),
      )
      .digest('hex');
    return {
      filters: canonicalFilters,
      studentCount: new Set(items.map((item) => item.studentId)).size,
      enrollmentCount: items.length,
      previewRevision: revision,
      items,
    };
  }
}
