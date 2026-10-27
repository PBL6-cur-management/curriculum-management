import { describe, expect, it } from 'vitest';
import {
  OrgUnitStatus,
  OrgUnitType,
  SubjectGroupStatus,
} from '../../generated/prisma/client.js';
import {
  ownerProblem,
  OWNER_PROBLEM,
  type OwnerFacultyRow,
  type OwnerGroupRow,
} from './course-owners.js';

const faculty: OwnerFacultyRow = {
  id: 'faculty',
  unitCode: 'CNTT',
  unitType: OrgUnitType.FACULTY,
  status: OrgUnitStatus.ACTIVE,
};
const group: OwnerGroupRow = {
  id: 'group',
  facultyId: faculty.id,
  status: SubjectGroupStatus.ACTIVE,
};
describe('ownerProblem', () => {
  it('accepts an active faculty and its active group', () => {
    expect(ownerProblem(faculty, group, true)).toBeNull();
  });
  it('allows no group when none is wanted', () => {
    expect(ownerProblem(faculty, null, false)).toBeNull();
  });
  it.each([
    null,
    { ...faculty, status: OrgUnitStatus.INACTIVE },
    { ...faculty, unitType: OrgUnitType.OFFICE },
  ])('refuses an invalid faculty before the group', (row) => {
    expect(ownerProblem(row, null, true)).toBe(OWNER_PROBLEM.FACULTY_INVALID);
  });
  it.each([
    null,
    { ...group, status: SubjectGroupStatus.INACTIVE },
    { ...group, facultyId: 'another' },
  ])('refuses a missing, inactive or unrelated group', (row) => {
    expect(ownerProblem(faculty, row, true)).toBe(OWNER_PROBLEM.GROUP_INVALID);
  });
});
