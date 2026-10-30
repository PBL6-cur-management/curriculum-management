import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { bestAcademicResults } from '../students/best-academic-results.js';
import {
  allocateGraduationCredits,
  graduationAttemptFacts,
  graduationClassKey,
} from './graduation-allocation.js';
import { decodeGraduationInput } from './graduation-input.codec.js';
import type { GraduationInputSnapshot } from './graduation-input.types.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import type {
  CompletionReason,
  GraduationResult,
  GraduationShortfall,
} from './graduation.types.js';

function sum(values: string[]): Prisma.Decimal {
  return values.reduce(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  );
}

function missing(required: string, earned: string): string {
  return Prisma.Decimal.max(
    new Prisma.Decimal(required).minus(earned),
    0,
  ).toString();
}

export function evaluateGraduation(
  value: GraduationInputSnapshot,
  evaluatedAt?: string,
): GraduationResult {
  const timestamp = evaluatedAt ?? new Date().toISOString();
  if (
    !Number.isFinite(new Date(timestamp).getTime()) ||
    new Date(timestamp).toISOString() !== timestamp
  )
    throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
  const input = decodeGraduationInput(value as unknown as Prisma.JsonValue);
  const allocation = allocateGraduationCredits(input);
  const shortfalls: GraduationShortfall[] = [];
  const courses = new Map(
    input.courses.map((course) => [course.course.id, course]),
  );
  const facts = bestAcademicResults(graduationAttemptFacts(input));
  const recognizedIds = new Set(
    allocation.recognitions.map((row) => row.curriculumItemId),
  );
  const recognizedClasses = new Set(
    allocation.recognitions.map((row) =>
      graduationClassKey(courses.get(row.studiedCourse.id)!),
    ),
  );
  for (const row of input.frame) {
    if (
      recognizedIds.has(row.id) ||
      (row.isElective && row.courseType !== 'CONDITIONAL')
    )
      continue;
    const key = graduationClassKey(courses.get(row.course.id)!);
    const relevant = facts.filter(
      (fact) => graduationClassKey(courses.get(fact.courseId)!) === key,
    );
    if (relevant.some((fact) => fact.isExempt && !fact.hasPassedAttempt))
      throw new AppException(GRADUATION_ERRORS.EXEMPTION_POLICY_UNCONFIRMED);
    const reason: CompletionReason = relevant.some(
      (fact) => fact.hasInProgressAttempt,
    )
      ? 'IN_PROGRESS'
      : relevant.some((fact) =>
            fact.attempts.some((attempt) => attempt.status === 'FAILED'),
          )
        ? 'FAILED'
        : 'NOT_TAKEN';
    const conditional = row.courseType === 'CONDITIONAL';
    const detail = {
      curriculumItemId: row.id,
      course: row.course,
      blockSymbol: row.blockSymbol,
      reason,
      message: `Chưa hoàn thành học phần ${conditional ? 'điều kiện' : 'bắt buộc'} ${row.course.courseCode}: ${reason === 'IN_PROGRESS' ? 'đang học' : reason === 'FAILED' ? 'chưa đạt' : 'chưa học'}.`,
    };
    shortfalls.push(
      conditional
        ? {
            ...detail,
            code: 'CONDITIONAL_COURSE_MISSING',
            category: 'CONDITIONAL_COURSE',
          }
        : {
            ...detail,
            code: 'MANDATORY_COURSE_MISSING',
            category: 'MANDATORY_COURSE',
          },
    );
  }
  const electiveGroups = [...input.groups]
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    )
    .map((group) => {
      const members = allocation.recognitions.filter(
        (row) => row.electiveGroupId === group.id,
      );
      const earnedCredits = sum(
        members.map((row) => row.recognizedCredits),
      ).toString();
      const earnedCourses = members.length;
      const missingCredits =
        group.minCredits === null
          ? null
          : missing(group.minCredits, earnedCredits);
      const missingCourses =
        group.minCourses === null
          ? null
          : Math.max(0, group.minCourses - earnedCourses);
      if (
        (missingCredits !== null && new Prisma.Decimal(missingCredits).gt(0)) ||
        (missingCourses !== null && missingCourses > 0)
      ) {
        const groupClasses = new Set(
          input.frame
            .filter((row) => row.electiveGroupId === group.id)
            .map((row) => graduationClassKey(courses.get(row.course.id)!)),
        );
        if (
          facts.some(
            (fact) =>
              fact.isExempt &&
              !fact.hasPassedAttempt &&
              groupClasses.has(
                graduationClassKey(courses.get(fact.courseId)!),
              ) &&
              (!recognizedClasses.has(
                graduationClassKey(courses.get(fact.courseId)!),
              ) ||
                (missingCredits !== null &&
                  new Prisma.Decimal(missingCredits).gt(0))),
          )
        )
          throw new AppException(
            GRADUATION_ERRORS.EXEMPTION_POLICY_UNCONFIRMED,
          );
      }
      if (missingCredits !== null && new Prisma.Decimal(missingCredits).gt(0))
        shortfalls.push({
          code: 'ELECTIVE_CREDITS_MISSING',
          category: 'ELECTIVE_GROUP',
          groupId: group.id,
          groupCode: group.groupCode,
          groupName: group.groupName,
          requiredCredits: group.minCredits!,
          earnedCredits,
          missingCredits,
          message: `Nhóm ${group.groupName} còn thiếu ${missingCredits} tín chỉ tự chọn.`,
        });
      if (missingCourses !== null && missingCourses > 0)
        shortfalls.push({
          code: 'ELECTIVE_COURSES_MISSING',
          category: 'ELECTIVE_GROUP',
          groupId: group.id,
          groupCode: group.groupCode,
          groupName: group.groupName,
          requiredCourses: group.minCourses!,
          earnedCourses,
          missingCourses,
          message: `Nhóm ${group.groupName} còn thiếu ${missingCourses} học phần thuộc các lớp tương đương khác nhau.`,
        });
      return {
        groupId: group.id,
        groupCode: group.groupCode,
        groupName: group.groupName,
        requiredCredits: group.minCredits,
        earnedCredits,
        missingCredits,
        requiredCourses: group.minCourses,
        earnedCourses,
        missingCourses,
      };
    });
  const compulsory = sum(
    allocation.recognitions
      .filter((row) => row.category !== 'ELECTIVE_GROUP')
      .map((row) => row.recognizedCredits),
  );
  const elective = sum(
    allocation.recognitions
      .filter((row) => row.category === 'ELECTIVE_GROUP')
      .map((row) => row.recognizedCredits),
  );
  const free = sum(allocation.freeCredits.map((row) => row.credits));
  const recognizedTotal = compulsory.plus(elective).plus(free).toString();
  const missingTotal = missing(input.version.totalCredits, recognizedTotal);
  if (new Prisma.Decimal(missingTotal).gt(0)) {
    if (facts.some((fact) => fact.isExempt && !fact.hasPassedAttempt))
      throw new AppException(GRADUATION_ERRORS.EXEMPTION_POLICY_UNCONFIRMED);
    shortfalls.push({
      code: 'TOTAL_CREDITS_MISSING',
      category: 'TOTAL_CREDITS',
      requiredCredits: input.version.totalCredits,
      earnedCredits: recognizedTotal,
      missingCredits: missingTotal,
      message: `Tổng tín chỉ được công nhận còn thiếu ${missingTotal} tín chỉ; chưa đủ điều kiện tốt nghiệp.`,
    });
  }
  const symbols = [...new Set(input.frame.map((row) => row.blockSymbol))].sort(
    (left, right) =>
      left === right
        ? 0
        : left === null
          ? -1
          : right === null
            ? 1
            : left < right
              ? -1
              : 1,
  );
  const knowledgeBlocks = symbols.map((symbol) => {
    const block = input.blocks.find((entry) => entry.blockCode === symbol);
    const members = allocation.recognitions.filter(
      (row) => row.blockSymbol === symbol,
    );
    const earnedCredits = sum(
      members.map((row) => row.recognizedCredits),
    ).toString();
    const catalogRequiredCredits = block?.requiredCredits ?? null;
    return {
      blockSymbol: symbol,
      blockName: block?.blockName ?? null,
      earnedCredits,
      compulsoryCredits: sum(
        members
          .filter((row) => row.category !== 'ELECTIVE_GROUP')
          .map((row) => row.recognizedCredits),
      ).toString(),
      electiveCredits: sum(
        members
          .filter((row) => row.category === 'ELECTIVE_GROUP')
          .map((row) => row.recognizedCredits),
      ).toString(),
      catalogRequiredCredits,
      advisoryGap:
        catalogRequiredCredits === null
          ? null
          : missing(catalogRequiredCredits, earnedCredits),
    };
  });
  shortfalls.sort((left, right) => {
    const categories = [
      'MANDATORY_COURSE',
      'ELECTIVE_GROUP',
      'TOTAL_CREDITS',
      'CONDITIONAL_COURSE',
    ];
    const categoryOrder =
      categories.indexOf(left.category) - categories.indexOf(right.category);
    if (categoryOrder) return categoryOrder;
    const compare = (first: string, second: string) =>
      first < second ? -1 : first > second ? 1 : 0;
    if ('curriculumItemId' in left && 'curriculumItemId' in right) {
      const first = input.frame.find(
        (row) => row.id === left.curriculumItemId,
      )!;
      const second = input.frame.find(
        (row) => row.id === right.curriculumItemId,
      )!;
      return (
        first.plannedSemester - second.plannedSemester ||
        first.sortOrder - second.sortOrder ||
        compare(first.course.courseCode, second.course.courseCode) ||
        compare(left.code, right.code) ||
        compare(first.id, second.id)
      );
    }
    if ('groupCode' in left && 'groupCode' in right)
      return (
        compare(left.groupCode, right.groupCode) ||
        compare(left.code, right.code) ||
        compare(left.groupId, right.groupId)
      );
    return compare(left.code, right.code);
  });
  return {
    schemaVersion: input.schemaVersion,
    ruleVersion: input.ruleVersion,
    evaluatedAt: timestamp,
    context: input.context,
    conclusion: shortfalls.length ? 'NOT_ELIGIBLE' : 'ELIGIBLE',
    shortfalls,
    warnings: allocation.warnings,
    credits: {
      requiredTotal: input.version.totalCredits,
      recognizedTotal,
      missingTotal,
      compulsory: compulsory.toString(),
      elective: elective.toString(),
      free: free.toString(),
    },
    electiveGroups,
    knowledgeBlocks,
    recognitions: allocation.recognitions,
    freeCredits: allocation.freeCredits,
  };
}
