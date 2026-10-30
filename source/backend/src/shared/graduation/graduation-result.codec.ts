import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import {
  GRADUATION_RULE_VERSION,
  GRADUATION_SCHEMA_VERSION,
  GRADUATION_SHORTFALL_CATEGORIES,
  GRADUATION_WARNING_CODES,
} from './graduation.constants.js';
import type { GraduationResult } from './graduation.types.js';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const nullableText = (value: unknown) => value === null || text(value);
const decimal = (value: unknown) =>
  text(value) && /^\d+(?:\.\d+)?$/.test(value);
const nullableDecimal = (value: unknown) => value === null || decimal(value);
const integer = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const nullableInteger = (value: unknown) => value === null || integer(value);
const date = (value: unknown) =>
  text(value) &&
  /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) &&
  Number.isFinite(Date.parse(value));
const fields = (
  value: Record<string, unknown>,
  names: string[],
  check: (entry: unknown) => boolean,
) => names.every((name) => check(value[name]));
const array = (value: unknown, check: (entry: unknown) => boolean) =>
  Array.isArray(value) && value.every(check);
const course = (value: unknown) =>
  record(value) && fields(value, ['id', 'courseCode', 'courseName'], text);
const basis = (value: unknown) =>
  value === 'APPLIED_VERSION_SNAPSHOT' || value === 'CURRENT_CATALOG';

function shortfall(value: unknown): boolean {
  if (!record(value) || !text(value.code) || !text(value.message)) return false;
  if (!(value.code in GRADUATION_SHORTFALL_CATEGORIES)) return false;
  const category = Object.entries(GRADUATION_SHORTFALL_CATEGORIES).find(
    ([code]) => code === value.code,
  )?.[1];
  if (value.category !== category) return false;
  if (
    value.code === 'MANDATORY_COURSE_MISSING' ||
    value.code === 'CONDITIONAL_COURSE_MISSING'
  )
    return (
      text(value.curriculumItemId) &&
      course(value.course) &&
      nullableText(value.blockSymbol) &&
      ['NOT_TAKEN', 'FAILED', 'IN_PROGRESS'].includes(String(value.reason))
    );
  if (
    value.code !== 'TOTAL_CREDITS_MISSING' &&
    !fields(value, ['groupId', 'groupCode', 'groupName'], text)
  )
    return false;
  return value.code === 'ELECTIVE_COURSES_MISSING'
    ? fields(
        value,
        ['requiredCourses', 'earnedCourses', 'missingCourses'],
        integer,
      ) &&
        Number(value.missingCourses) > 0 &&
        Number(value.requiredCourses) - Number(value.earnedCourses) ===
          value.missingCourses
    : fields(
        value,
        ['requiredCredits', 'earnedCredits', 'missingCredits'],
        decimal,
      ) &&
        new Prisma.Decimal(String(value.missingCredits)).greaterThan(0) &&
        new Prisma.Decimal(String(value.requiredCredits))
          .minus(String(value.earnedCredits))
          .equals(String(value.missingCredits));
}

function validResult(value: unknown): value is GraduationResult {
  if (
    !record(value) ||
    value.schemaVersion !== GRADUATION_SCHEMA_VERSION ||
    value.ruleVersion !== GRADUATION_RULE_VERSION ||
    !date(value.evaluatedAt)
  )
    return false;
  const context = value.context;
  if (
    !record(context) ||
    !fields(
      context,
      [
        'studentId',
        'programId',
        'semesterId',
        'enrollmentId',
        'studentCode',
        'fullName',
        'programCode',
        'programName',
        'cohortId',
        'cohortCode',
        'programVersionId',
        'versionNumber',
        'semesterCode',
      ],
      text,
    ) ||
    !date(context.semesterStartDate) ||
    !nullableText(context.cohortAssignmentId) ||
    !['COHORT', 'EXCEPTION'].includes(String(context.versionSource))
  )
    return false;
  if (
    context.versionSource === 'COHORT'
      ? !text(context.cohortAssignmentId)
      : context.cohortAssignmentId !== null
  )
    return false;
  if (
    !array(value.shortfalls, shortfall) ||
    !Array.isArray(value.shortfalls) ||
    value.conclusion !== (value.shortfalls.length ? 'NOT_ELIGIBLE' : 'ELIGIBLE')
  )
    return false;
  if (
    !record(value.credits) ||
    !fields(
      value.credits,
      [
        'requiredTotal',
        'recognizedTotal',
        'missingTotal',
        'compulsory',
        'elective',
        'free',
      ],
      decimal,
    )
  )
    return false;
  const credits = value.credits;
  if (
    !new Prisma.Decimal(String(credits.compulsory))
      .plus(String(credits.elective))
      .plus(String(credits.free))
      .equals(String(credits.recognizedTotal)) ||
    !Prisma.Decimal.max(
      0,
      new Prisma.Decimal(String(credits.requiredTotal)).minus(
        String(credits.recognizedTotal),
      ),
    ).equals(String(credits.missingTotal))
  )
    return false;
  if (
    !array(
      value.warnings,
      (entry) =>
        record(entry) &&
        GRADUATION_WARNING_CODES.some((code) => code === entry.code) &&
        fields(entry, ['curriculumItemId', 'courseId'], nullableText) &&
        nullableDecimal(entry.creditGap) &&
        text(entry.message),
    )
  )
    return false;
  if (
    !array(
      value.electiveGroups,
      (entry) =>
        record(entry) &&
        fields(entry, ['groupId', 'groupCode', 'groupName'], text) &&
        fields(entry, ['requiredCredits', 'missingCredits'], nullableDecimal) &&
        decimal(entry.earnedCredits) &&
        fields(entry, ['requiredCourses', 'missingCourses'], nullableInteger) &&
        integer(entry.earnedCourses),
    )
  )
    return false;
  if (
    !array(
      value.knowledgeBlocks,
      (entry) =>
        record(entry) &&
        fields(entry, ['blockSymbol', 'blockName'], nullableText) &&
        fields(
          entry,
          ['earnedCredits', 'compulsoryCredits', 'electiveCredits'],
          decimal,
        ) &&
        fields(
          entry,
          ['catalogRequiredCredits', 'advisoryGap'],
          nullableDecimal,
        ),
    )
  )
    return false;
  const recognizedAttempts = new Set<string>();
  const recognizedItems = new Set<string>();
  const recognizedClasses = new Set<string>();
  const studiedCourses = new Set<string>();
  if (
    !array(value.recognitions, (entry) => {
      if (
        !record(entry) ||
        !fields(entry, ['curriculumItemId', 'attemptId'], text) ||
        !course(entry.requiredCourse) ||
        !course(entry.studiedCourse) ||
        !integer(entry.attemptRevision) ||
        Number(entry.attemptRevision) < 1 ||
        !['PASSED', 'EXEMPT'].includes(String(entry.completionStatus)) ||
        typeof entry.viaEquivalence !== 'boolean' ||
        !fields(
          entry,
          ['equivalenceGroupId', 'electiveGroupId', 'blockSymbol'],
          nullableText,
        ) ||
        !fields(entry, ['requiredCredits', 'recognizedCredits'], decimal) ||
        !basis(entry.creditBasis) ||
        !['MANDATORY_COURSE', 'ELECTIVE_GROUP', 'CONDITIONAL_COURSE'].includes(
          String(entry.category),
        )
      )
        return false;
      const attemptId = String(entry.attemptId);
      const itemId = String(entry.curriculumItemId);
      if (!record(entry.studiedCourse) || !record(entry.requiredCourse))
        return false;
      const courseId = String(entry.studiedCourse.id);
      const classKey =
        entry.equivalenceGroupId === null
          ? `course:${courseId}`
          : `group:${String(entry.equivalenceGroupId)}`;
      if (
        recognizedAttempts.has(attemptId) ||
        recognizedItems.has(itemId) ||
        recognizedClasses.has(classKey) ||
        studiedCourses.has(courseId) ||
        entry.viaEquivalence !==
          (entry.studiedCourse.id !== entry.requiredCourse.id) ||
        (entry.viaEquivalence && entry.equivalenceGroupId === null)
      )
        return false;
      recognizedAttempts.add(attemptId);
      recognizedItems.add(itemId);
      recognizedClasses.add(classKey);
      studiedCourses.add(courseId);
      return true;
    })
  )
    return false;
  return array(value.freeCredits, (entry) => {
    if (
      !record(entry) ||
      !course(entry.course) ||
      !text(entry.attemptId) ||
      !decimal(entry.credits) ||
      !basis(entry.creditBasis) ||
      !['SURPLUS_EQUIVALENT', 'OUTSIDE_FRAME'].includes(String(entry.reason)) ||
      recognizedAttempts.has(entry.attemptId)
    )
      return false;
    if (!record(entry.course) || studiedCourses.has(String(entry.course.id)))
      return false;
    recognizedAttempts.add(entry.attemptId);
    studiedCourses.add(String(entry.course.id));
    return true;
  });
}

export function decodeGraduationResult(
  value: Prisma.JsonValue,
): GraduationResult {
  if (
    record(value) &&
    (value.schemaVersion !== GRADUATION_SCHEMA_VERSION ||
      value.ruleVersion !== GRADUATION_RULE_VERSION)
  )
    throw new AppException(GRADUATION_ERRORS.UNSUPPORTED_SCHEMA_VERSION);
  if (!validResult(value))
    throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
  return value;
}

export function encodeGraduationResult(
  value: GraduationResult,
): Prisma.InputJsonValue {
  const json: Prisma.JsonValue = JSON.parse(JSON.stringify(value));
  decodeGraduationResult(json);
  return json as Prisma.InputJsonValue;
}
