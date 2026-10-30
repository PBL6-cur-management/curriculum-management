import { createHash } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import {
  GRADUATION_RULE_VERSION,
  GRADUATION_SCHEMA_VERSION,
} from './graduation.constants.js';
import type { GraduationInputSnapshot } from './graduation-input.types.js';

const COURSE_TYPES = [
  'THEORY',
  'PRACTICE',
  'LAB',
  'PROJECT',
  'CAPSTONE',
  'INTERNSHIP',
  'CONDITIONAL',
];
const DECIMAL = /^\d+(?:\.\d+)?$/;

function invalid(): never {
  throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(record, key))
  )
    invalid();
  return record;
}

function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) invalid();
}

function nullableText(value: unknown): void {
  if (value !== null) text(value);
}

function decimal(value: unknown, maximum?: string): void {
  if (typeof value !== 'string' || !DECIMAL.test(value)) invalid();
  const number = new Prisma.Decimal(value);
  if (!number.isFinite() || (maximum !== undefined && number.gt(maximum)))
    invalid();
}

function integer(value: unknown, minimum = 0): void {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    invalid();
}

function date(value: unknown): void {
  text(value);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value)
    invalid();
}

function member(value: unknown, values: readonly unknown[]): void {
  if (!values.includes(value)) invalid();
}

function array(value: unknown, validate: (entry: unknown) => void): void {
  if (!Array.isArray(value)) invalid();
  for (const entry of value) validate(entry);
}

function course(value: unknown): void {
  const record = object(value, ['id', 'courseCode', 'courseName']);
  Object.values(record).forEach(text);
}

function unique(values: string[]): void {
  if (new Set(values).size !== values.length) invalid();
}

export function decodeGraduationInput(
  value: Prisma.JsonValue,
): GraduationInputSnapshot {
  const root = object(value, [
    'schemaVersion',
    'ruleVersion',
    'context',
    'version',
    'frame',
    'groups',
    'blocks',
    'courses',
    'attempts',
  ]);
  if (
    root.schemaVersion !== GRADUATION_SCHEMA_VERSION ||
    root.ruleVersion !== GRADUATION_RULE_VERSION
  ) {
    throw new AppException(GRADUATION_ERRORS.UNSUPPORTED_SCHEMA_VERSION);
  }
  const context = object(root.context, [
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
    'semesterStartDate',
    'versionSource',
    'cohortAssignmentId',
  ]);
  for (const [key, field] of Object.entries(context)) {
    if (key === 'cohortAssignmentId') nullableText(field);
    else text(field);
  }
  date(context.semesterStartDate);
  member(context.versionSource, ['COHORT', 'EXCEPTION']);
  if (context.versionSource === 'COHORT' && context.cohortAssignmentId === null)
    invalid();
  const version = object(root.version, [
    'totalCredits',
    'compulsoryCredits',
    'electiveCredits',
  ]);
  Object.values(version).forEach((field) => decimal(field));
  array(root.frame, (entry) => {
    const row = object(entry, [
      'id',
      'course',
      'credits',
      'courseType',
      'isElective',
      'electiveGroupId',
      'blockSymbol',
      'plannedSemester',
      'sortOrder',
    ]);
    text(row.id);
    course(row.course);
    decimal(row.credits);
    member(row.courseType, COURSE_TYPES);
    if (typeof row.isElective !== 'boolean') invalid();
    nullableText(row.electiveGroupId);
    nullableText(row.blockSymbol);
    integer(row.plannedSemester, 1);
    integer(row.sortOrder);
  });
  array(root.groups, (entry) => {
    const group = object(entry, [
      'id',
      'groupCode',
      'groupName',
      'minCredits',
      'minCourses',
    ]);
    text(group.id);
    text(group.groupCode);
    text(group.groupName);
    if (group.minCredits !== null) decimal(group.minCredits);
    if (group.minCourses !== null) integer(group.minCourses);
    if (group.minCredits === null && group.minCourses === null) invalid();
  });
  array(root.blocks, (entry) => {
    const block = object(entry, ['blockCode', 'blockName', 'requiredCredits']);
    text(block.blockCode);
    text(block.blockName);
    if (block.requiredCredits !== null) decimal(block.requiredCredits);
  });
  array(root.courses, (entry) => {
    const item = object(entry, [
      'course',
      'courseType',
      'credits',
      'creditBasis',
      'equivalenceGroupId',
    ]);
    course(item.course);
    member(item.courseType, COURSE_TYPES);
    decimal(item.credits);
    member(item.creditBasis, ['APPLIED_VERSION_SNAPSHOT', 'CURRENT_CATALOG']);
    nullableText(item.equivalenceGroupId);
  });
  array(root.attempts, (entry) => {
    const attempt = object(entry, [
      'id',
      'revision',
      'courseId',
      'semesterId',
      'dataSource',
      'semesterStartDate',
      'score10',
      'score4',
      'letterGrade',
      'status',
    ]);
    text(attempt.id);
    text(attempt.courseId);
    text(attempt.semesterId);
    integer(attempt.revision, 1);
    member(attempt.dataSource, ['EXCEL', 'SCHOOL_DB']);
    date(attempt.semesterStartDate);
    member(attempt.status, ['PASSED', 'FAILED', 'EXEMPT', 'IN_PROGRESS']);
    nullableText(attempt.letterGrade);
    if (attempt.score10 !== null) decimal(attempt.score10, '10');
    if (attempt.score4 !== null) decimal(attempt.score4, '4');
    if (
      (attempt.status === 'PASSED' || attempt.status === 'FAILED') &&
      (attempt.score10 === null ||
        attempt.score4 === null ||
        attempt.letterGrade === null)
    )
      invalid();
    if (
      (attempt.status === 'EXEMPT' || attempt.status === 'IN_PROGRESS') &&
      (attempt.score10 !== null ||
        attempt.score4 !== null ||
        attempt.letterGrade !== null)
    )
      invalid();
  });
  const input = root as unknown as GraduationInputSnapshot;
  if (input.frame.length === 0)
    throw new AppException(GRADUATION_ERRORS.SNAPSHOT_INCOMPLETE);
  unique(input.frame.map((row) => row.id));
  unique(input.frame.map((row) => row.course.id));
  unique(input.groups.map((group) => group.id));
  unique(input.groups.map((group) => group.groupCode));
  unique(input.blocks.map((block) => block.blockCode));
  unique(input.courses.map((item) => item.course.id));
  unique(input.attempts.map((attempt) => attempt.id));
  const courses = new Map(input.courses.map((item) => [item.course.id, item]));
  const groups = new Set(input.groups.map((group) => group.id));
  for (const row of input.frame) {
    const fact = courses.get(row.course.id);
    if (
      !fact ||
      fact.creditBasis !== 'APPLIED_VERSION_SNAPSHOT' ||
      fact.credits !== row.credits ||
      fact.courseType !== row.courseType ||
      (row.electiveGroupId !== null &&
        (!row.isElective || !groups.has(row.electiveGroupId)))
    )
      invalid();
  }
  const frameIds = new Set(input.frame.map((row) => row.course.id));
  for (const fact of input.courses) {
    if (
      fact.creditBasis !==
      (frameIds.has(fact.course.id)
        ? 'APPLIED_VERSION_SNAPSHOT'
        : 'CURRENT_CATALOG')
    )
      invalid();
  }
  const semesterDates = new Map<string, string>([
    [input.context.semesterId, input.context.semesterStartDate],
  ]);
  unique(
    input.attempts.map(
      (attempt) => `${attempt.courseId}\u0000${attempt.semesterId}`,
    ),
  );
  for (const attempt of input.attempts) {
    if (
      !courses.has(attempt.courseId) ||
      attempt.semesterStartDate > input.context.semesterStartDate
    )
      invalid();
    const known = semesterDates.get(attempt.semesterId);
    if (known !== undefined && known !== attempt.semesterStartDate) invalid();
    semesterDates.set(attempt.semesterId, attempt.semesterStartDate);
  }
  return JSON.parse(JSON.stringify(input)) as GraduationInputSnapshot;
}

function canonical(value: unknown): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value
      .map((entry) => canonical(entry))
      .sort((left, right) => {
        const identity = (entry: Prisma.InputJsonValue) => {
          const record = entry as Record<string, unknown>;
          return String(
            record.id ??
              record.blockCode ??
              (record.course as { id: string } | undefined)?.id ??
              '',
          );
        };
        const leftId = identity(left);
        const rightId = identity(right);
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
      });
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, field]) => [key, field === null ? null : canonical(field)]),
    );
  }
  return value as string | number | boolean;
}

export function encodeGraduationInput(
  value: GraduationInputSnapshot,
): Prisma.InputJsonValue {
  return canonical(decodeGraduationInput(value as unknown as Prisma.JsonValue));
}

export function graduationInputDigest(value: GraduationInputSnapshot): string {
  return createHash('sha256')
    .update(JSON.stringify(encodeGraduationInput(value)))
    .digest('hex');
}
