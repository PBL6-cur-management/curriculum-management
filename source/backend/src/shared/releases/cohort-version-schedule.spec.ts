import { describe, expect, it } from 'vitest';
import type { CohortAssignmentFact } from './applied-version.types.js';
import {
  assignmentRevision,
  compareAssignmentsNewestFirst,
  pickAppliedAssignment,
  type ScheduleRevisionInput,
} from './cohort-version-schedule.js';
import type { StartedSemester } from './semester-start.js';

const semester = (id: string, date: string): StartedSemester => ({
  id,
  semesterCode: id,
  academicYear: 'not-chronological',
  termInYear: 1,
  startDate: new Date(date),
  createdAt: new Date(date),
  updatedAt: new Date(date),
});
const first = semester('Z', '2025-01-01');
const middle = semester('X', '2025-09-01');
const last = semester('A', '2026-01-01');
function assignment(
  id: string,
  fromSemester = first,
  createdAt = '2026-01-01',
): CohortAssignmentFact {
  return {
    id,
    cohort: { id: 'cohort', cohortCode: 'K2023', intakeYear: 2023 },
    version: {
      id: `v-${id}`,
      programId: 'p',
      versionNumber: '1.0',
      status: 'HISTORICAL',
      decisionNumber: 'QD',
      publishedAt: new Date(createdAt),
      effectiveSemester: first,
    },
    fromSemester,
    createdAt: new Date(createdAt),
  };
}
describe('cohort schedule selection', () => {
  it('uses dates, not lexical codes, ACTIVE status, intake year or version number', () => {
    const original = assignment('old');
    const future = assignment('future', last);
    future.version.status = 'PENDING';
    future.version.versionNumber = '2.0';
    expect(pickAppliedAssignment([future, original], middle)).toBe(original);
    expect(pickAppliedAssignment([original, future], last)).toBe(future);
    expect(pickAppliedAssignment([future], first)).toBeNull();
    expect(pickAppliedAssignment([], last)).toBeNull();
  });
  it('breaks legacy date ties by createdAt then codepoint descending id independently of input order', () => {
    const old = assignment('z', first, '2025-01-01');
    const left = assignment('a');
    const right = assignment('z');
    for (const rows of [
      [old, left, right],
      [right, old, left],
      [left, right, old],
    ])
      expect(pickAppliedAssignment(rows, first)).toBe(right);
    expect(compareAssignmentsNewestFirst(right, right)).toBe(0);
    expect(compareAssignmentsNewestFirst(left, right)).toBeGreaterThan(0);
  });
  it('does not mutate the supplied rows', () => {
    const rows = [assignment('old'), assignment('new', last)];
    const copy = [...rows];
    pickAppliedAssignment(rows, last);
    expect(rows).toEqual(copy);
  });
});

describe('schedule revision', () => {
  const input: ScheduleRevisionInput = {
    programId: 'p',
    links: [
      {
        id: 'b',
        cohortId: 'c',
        programVersionId: 'v1',
        fromSemesterId: 's1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'a',
        cohortId: 'other',
        programVersionId: 'v2',
        fromSemesterId: 's2',
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ],
    semesters: [
      { id: 's2', startDate: null },
      { id: 's1', startDate: '2026-01-01T00:00:00.000Z' },
    ],
  };
  it('is a deterministic sha256 digest independent of query order and property insertion order', () => {
    const digest = assignmentRevision(input);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(
      assignmentRevision({
        ...input,
        links: [...input.links].reverse().map((row) => ({
          createdAt: row.createdAt,
          fromSemesterId: row.fromSemesterId,
          programVersionId: row.programVersionId,
          cohortId: row.cohortId,
          id: row.id,
        })),
        semesters: [...input.semesters].reverse(),
      }),
    ).toBe(digest);
  });
  it('changes for calendar edits including previously unknown/unrelated targets and every link field', () => {
    const digest = assignmentRevision(input);
    expect(
      assignmentRevision({
        ...input,
        semesters: [{ id: 's2', startDate: '2027-01-01' }, input.semesters[1]],
      }),
    ).not.toBe(digest);
    for (const field of [
      'id',
      'cohortId',
      'programVersionId',
      'fromSemesterId',
      'createdAt',
    ] as const) {
      expect(
        assignmentRevision({
          ...input,
          links: [{ ...input.links[0], [field]: 'changed' }, input.links[1]],
        }),
      ).not.toBe(digest);
    }
    expect(assignmentRevision({ ...input, programId: 'other' })).not.toBe(
      digest,
    );
  });
  it('does not include mutable lifecycle metadata', () => {
    const withStatus = {
      ...input,
      links: input.links.map((row) => ({ ...row, status: 'ACTIVE' })),
    };
    expect(assignmentRevision(withStatus)).toBe(assignmentRevision(input));
  });
});
