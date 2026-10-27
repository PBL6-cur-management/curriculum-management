import {
  OrgUnitStatus,
  OrgUnitType,
  SubjectGroupStatus,
} from '../../generated/prisma/client.js';

export interface OwnerFacultyRow {
  id: string;
  unitCode: string;
  unitType: OrgUnitType;
  status: OrgUnitStatus;
}

export interface OwnerGroupRow {
  id: string;
  facultyId: string;
  status: SubjectGroupStatus;
}

export const OWNER_PROBLEM = {
  FACULTY_INVALID: 'FACULTY_INVALID',
  GROUP_INVALID: 'GROUP_INVALID',
} as const;
export type OwnerProblem = (typeof OWNER_PROBLEM)[keyof typeof OWNER_PROBLEM];

export function ownerProblem(
  faculty: OwnerFacultyRow | null,
  group: OwnerGroupRow | null,
  groupWanted: boolean,
): OwnerProblem | null {
  if (
    !faculty ||
    faculty.unitType !== OrgUnitType.FACULTY ||
    faculty.status !== OrgUnitStatus.ACTIVE
  )
    return OWNER_PROBLEM.FACULTY_INVALID;
  if (
    groupWanted &&
    (!group ||
      group.status !== SubjectGroupStatus.ACTIVE ||
      group.facultyId !== faculty.id)
  )
    return OWNER_PROBLEM.GROUP_INVALID;
  return null;
}
