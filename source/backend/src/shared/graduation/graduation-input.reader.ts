import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import {
  GRADUATION_RULE_VERSION,
  GRADUATION_SCHEMA_VERSION,
} from './graduation.constants.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import type { GraduationReaderCapability } from './graduation-capability.js';
import {
  decodeGraduationInput,
  encodeGraduationInput,
} from './graduation-input.codec.js';
import type { GraduationInputSnapshot } from './graduation-input.types.js';

@Injectable()
export class GraduationInputReader {
  async read(
    capability: GraduationReaderCapability,
    tx: Prisma.TransactionClient,
  ): Promise<GraduationInputSnapshot> {
    const resolved = await capability.resolve(tx);
    const [enrollment, semester, version] = await Promise.all([
      tx.programEnrollment.findUnique({
        where: { id: resolved.enrollmentId },
        include: { student: true, cohort: true },
      }),
      tx.semester.findUnique({ where: { id: resolved.semesterId } }),
      tx.programVersion.findUnique({
        where: { id: resolved.programVersionId },
        include: {
          program: true,
          effectiveSemester: true,
          curriculumItems: {
            include: { course: true },
            orderBy: { id: 'asc' },
          },
          electiveGroups: { orderBy: { id: 'asc' } },
        },
      }),
    ]);
    if (
      !enrollment ||
      !semester?.startDate ||
      !version ||
      enrollment.studentId !== resolved.studentId ||
      enrollment.programId !== resolved.programId ||
      version.programId !== resolved.programId
    ) {
      throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
    }
    if (
      version.status === 'DRAFT' ||
      version.sourceRequestId !== null ||
      !version.versionNumber ||
      !version.decisionNumber ||
      !version.publishedAt ||
      !version.effectiveSemester?.startDate ||
      version.effectiveSemester.startDate > semester.startDate ||
      version.curriculumItems.length === 0
    ) {
      throw new AppException(GRADUATION_ERRORS.SNAPSHOT_INCOMPLETE);
    }
    for (const row of version.curriculumItems) {
      if (!row.courseNameSnapshot?.trim() || row.creditsSnapshot === null)
        throw new AppException(GRADUATION_ERRORS.SNAPSHOT_INCOMPLETE);
    }
    const attempts = await capability.attempts(tx);
    if (attempts.some((attempt) => attempt.studentId !== resolved.studentId))
      throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
    const courseIds = [
      ...new Set([
        ...version.curriculumItems.map((row) => row.courseId),
        ...attempts.map((attempt) => attempt.courseId),
      ]),
    ];
    const catalog = await tx.course.findMany({
      where: { id: { in: courseIds } },
      orderBy: { id: 'asc' },
    });
    if (courseIds.some((id) => !catalog.some((course) => course.id === id)))
      throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
    const equivalenceIds = [
      ...new Set(
        catalog.flatMap((course) =>
          course.equivalenceGroupId === null ? [] : [course.equivalenceGroupId],
        ),
      ),
    ];
    const [members, blocks] = await Promise.all([
      tx.course.findMany({
        where: { equivalenceGroupId: { in: equivalenceIds } },
        orderBy: { id: 'asc' },
      }),
      tx.knowledgeBlock.findMany({ orderBy: { blockCode: 'asc' } }),
    ]);
    const frameByCourse = new Map(
      version.curriculumItems.map((row) => [row.courseId, row]),
    );
    const courses = new Map(
      [...catalog, ...members].map((course) => [course.id, course]),
    );
    const input: GraduationInputSnapshot = {
      schemaVersion: GRADUATION_SCHEMA_VERSION,
      ruleVersion: GRADUATION_RULE_VERSION,
      context: {
        studentId: resolved.studentId,
        programId: resolved.programId,
        semesterId: resolved.semesterId,
        enrollmentId: enrollment.id,
        studentCode: enrollment.student.studentCode,
        fullName: enrollment.student.fullName,
        programCode: version.program.programCode,
        programName: version.programName,
        cohortId: enrollment.cohortId,
        cohortCode: enrollment.cohort.cohortCode,
        programVersionId: version.id,
        versionNumber: version.versionNumber,
        semesterCode: semester.semesterCode,
        semesterStartDate: semester.startDate.toISOString(),
        versionSource: resolved.source,
        cohortAssignmentId: resolved.cohortAssignmentId,
      },
      version: {
        totalCredits: version.totalCredits.toString(),
        compulsoryCredits: version.compulsoryCredits.toString(),
        electiveCredits: version.electiveCredits.toString(),
      },
      frame: version.curriculumItems.map((row) => ({
        id: row.id,
        course: {
          id: row.courseId,
          courseCode: row.course.courseCode,
          courseName: row.courseNameSnapshot!,
        },
        credits: row.creditsSnapshot!.toString(),
        courseType: row.course.courseType,
        isElective: row.isElective,
        electiveGroupId: row.electiveGroupId,
        blockSymbol: row.blockSymbol,
        plannedSemester: row.plannedSemester,
        sortOrder: row.sortOrder,
      })),
      groups: version.electiveGroups.map((group) => ({
        id: group.id,
        groupCode: group.groupCode,
        groupName: group.groupName,
        minCredits: group.minCredits?.toString() ?? null,
        minCourses: group.minCourses,
      })),
      blocks: blocks.map((block) => ({
        blockCode: block.blockCode,
        blockName: block.blockName,
        requiredCredits: block.requiredCredits?.toString() ?? null,
      })),
      courses: [...courses.values()].map((course) => {
        const row = frameByCourse.get(course.id);
        return {
          course: {
            id: course.id,
            courseCode: course.courseCode,
            courseName: course.courseName,
          },
          courseType: course.courseType,
          credits: row
            ? row.creditsSnapshot!.toString()
            : course.credits.toString(),
          creditBasis: row ? 'APPLIED_VERSION_SNAPSHOT' : 'CURRENT_CATALOG',
          equivalenceGroupId: course.equivalenceGroupId,
        };
      }),
      attempts: attempts.map((attempt) => {
        if (
          !(attempt.semesterStart instanceof Date) ||
          !Number.isFinite(attempt.semesterStart.getTime())
        )
          throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
        return {
          id: attempt.id,
          revision: attempt.revision,
          courseId: attempt.courseId,
          semesterId: attempt.semesterId,
          dataSource: attempt.dataSource,
          semesterStartDate: attempt.semesterStart.toISOString(),
          score10: attempt.score10,
          score4: attempt.score4,
          letterGrade: attempt.letterGrade,
          status: attempt.status,
        };
      }),
    };
    return decodeGraduationInput(
      encodeGraduationInput(input) as Prisma.JsonValue,
    );
  }
}
