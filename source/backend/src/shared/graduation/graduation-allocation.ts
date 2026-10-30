import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import {
  bestAcademicResults,
  type AcademicAttemptFact,
} from '../students/best-academic-results.js';
import { decodeGraduationInput } from './graduation-input.codec.js';
import type {
  GraduationFrameFact,
  GraduationInputSnapshot,
} from './graduation-input.types.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import type {
  GraduationFreeCredit,
  GraduationRecognition,
  GraduationWarning,
} from './graduation.types.js';

export type GraduationAllocation = {
  recognitions: GraduationRecognition[];
  freeCredits: GraduationFreeCredit[];
  warnings: GraduationWarning[];
};

type CourseFact = GraduationInputSnapshot['courses'][number];
type Completion = { course: CourseFact; attempt: AcademicAttemptFact };

export function graduationClassKey(course: CourseFact): string {
  return course.equivalenceGroupId === null
    ? `course:${course.course.id}`
    : `group:${course.equivalenceGroupId}`;
}

export function graduationAttemptFacts(
  input: GraduationInputSnapshot,
): AcademicAttemptFact[] {
  return input.attempts.map(({ semesterStartDate, ...attempt }) => ({
    ...attempt,
    studentId: input.context.studentId,
    semesterStart: new Date(semesterStartDate),
  }));
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function category(row: GraduationFrameFact): GraduationRecognition['category'] {
  return row.courseType === 'CONDITIONAL'
    ? 'CONDITIONAL_COURSE'
    : row.isElective
      ? 'ELECTIVE_GROUP'
      : 'MANDATORY_COURSE';
}

function destination(row: GraduationFrameFact): string {
  return category(row) === 'ELECTIVE_GROUP'
    ? `elective:${row.electiveGroupId ?? ''}`
    : `${category(row)}:${row.id}`;
}

function ambiguous(): never {
  throw new AppException(GRADUATION_ERRORS.EQUIVALENCE_ALLOCATION_AMBIGUOUS);
}

export function allocateGraduationCredits(
  value: GraduationInputSnapshot,
): GraduationAllocation {
  const input = decodeGraduationInput(value as unknown as Prisma.JsonValue);
  if (
    input.frame.some(
      (row) => row.courseType === 'CONDITIONAL' && row.isElective,
    )
  )
    throw new AppException(GRADUATION_ERRORS.POLICY_UNCONFIRMED);
  const result: GraduationAllocation = {
    recognitions: [],
    freeCredits: [],
    warnings: [],
  };
  const courses = new Map(
    input.courses.map((course) => [course.course.id, course]),
  );
  const rowsByClass = new Map<string, GraduationFrameFact[]>();
  for (const row of input.frame) {
    const key = graduationClassKey(courses.get(row.course.id)!);
    rowsByClass.set(key, [...(rowsByClass.get(key) ?? []), row]);
    if (
      row.blockSymbol === null ||
      !input.blocks.some((block) => block.blockCode === row.blockSymbol)
    ) {
      result.warnings.push({
        code: 'UNKNOWN_KNOWLEDGE_BLOCK',
        curriculumItemId: row.id,
        courseId: row.course.id,
        creditGap: null,
        message: `Học phần ${row.course.courseCode} chưa có khối kiến thức được xác định; vẫn giữ nguyên tín chỉ được công nhận.`,
      });
    }
  }
  const completedByClass = new Map<string, Completion[]>();
  const attempts = graduationAttemptFacts(input);
  const allFacts = bestAcademicResults(attempts);
  const passedFacts = new Map(
    bestAcademicResults(
      attempts.filter((attempt) => attempt.status === 'PASSED'),
    ).map((fact) => [fact.courseId, fact]),
  );
  for (const fact of allFacts) {
    if (!fact.hasPassedAttempt) continue;
    const completion: Completion = {
      course: courses.get(fact.courseId)!,
      attempt: passedFacts.get(fact.courseId)!.bestScoredAttempt!,
    };
    const key = graduationClassKey(completion.course);
    completedByClass.set(key, [
      ...(completedByClass.get(key) ?? []),
      completion,
    ]);
  }
  for (const [key, completions] of [...completedByClass.entries()].sort(
    ([left], [right]) => compare(left, right),
  )) {
    const rows = rowsByClass.get(key) ?? [];
    if (new Set(rows.map(destination)).size > 1) ambiguous();
    const pairs = rows.flatMap((row) =>
      completions.map((completion) => ({ row, completion })),
    );
    const direct = pairs.filter(
      ({ row, completion }) => row.course.id === completion.course.course.id,
    );
    const candidates = direct.length ? direct : pairs;
    if (
      new Set(
        candidates.map(({ completion }) =>
          new Prisma.Decimal(completion.course.credits).toString(),
        ),
      ).size > 1
    )
      ambiguous();
    candidates.sort(
      (left, right) =>
        compare(left.row.course.courseCode, right.row.course.courseCode) ||
        compare(left.row.id, right.row.id) ||
        compare(
          left.completion.course.course.courseCode,
          right.completion.course.course.courseCode,
        ) ||
        compare(
          left.completion.course.course.id,
          right.completion.course.course.id,
        ),
    );
    const chosen = candidates[0];
    if (chosen) {
      const { row, completion } = chosen;
      const viaEquivalence = row.course.id !== completion.course.course.id;
      result.recognitions.push({
        curriculumItemId: row.id,
        requiredCourse: row.course,
        studiedCourse: completion.course.course,
        attemptId: completion.attempt.id,
        attemptRevision: completion.attempt.revision,
        completionStatus: 'PASSED',
        viaEquivalence,
        equivalenceGroupId: completion.course.equivalenceGroupId,
        requiredCredits: row.credits,
        recognizedCredits: completion.course.credits,
        creditBasis: completion.course.creditBasis,
        category: category(row),
        electiveGroupId: row.electiveGroupId,
        blockSymbol: row.blockSymbol,
      });
      const gap = new Prisma.Decimal(row.credits).minus(
        completion.course.credits,
      );
      if (viaEquivalence && gap.gt(0))
        result.warnings.push({
          code: 'EQUIVALENT_CREDIT_GAP',
          curriculumItemId: row.id,
          courseId: completion.course.course.id,
          creditGap: gap.toString(),
          message: `Học phần ${completion.course.course.courseCode} đã hoàn thành yêu cầu ${row.course.courseCode} nhưng ít hơn ${gap.toString()} tín chỉ; kiểm tra tổng tín chỉ và nhóm tự chọn.`,
        });
    }
    for (const completion of completions) {
      if (completion !== chosen?.completion) {
        result.freeCredits.push({
          course: completion.course.course,
          attemptId: completion.attempt.id,
          credits: completion.course.credits,
          creditBasis: completion.course.creditBasis,
          reason: chosen ? 'SURPLUS_EQUIVALENT' : 'OUTSIDE_FRAME',
        });
      }
      if (completion.course.creditBasis === 'CURRENT_CATALOG')
        result.warnings.push({
          code: 'CURRENT_CATALOG_CREDIT_BASIS',
          curriculumItemId:
            completion === chosen?.completion ? chosen.row.id : null,
          courseId: completion.course.course.id,
          creditGap: null,
          message: `Tín chỉ học phần ${completion.course.course.courseCode} lấy từ danh mục hiện tại, không phải chứng nhận tín chỉ lịch sử; cần đối chiếu khi chứng nhận chính thức.`,
        });
    }
  }
  result.recognitions.sort((left, right) =>
    compare(left.curriculumItemId, right.curriculumItemId),
  );
  result.freeCredits.sort((left, right) =>
    compare(left.course.id, right.course.id),
  );
  result.warnings.sort(
    (left, right) =>
      compare(left.code, right.code) ||
      compare(left.curriculumItemId ?? '', right.curriculumItemId ?? '') ||
      compare(left.courseId ?? '', right.courseId ?? ''),
  );
  return result;
}
