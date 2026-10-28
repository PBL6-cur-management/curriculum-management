import type { PermissionCode } from '../../shared/auth/permissions';
import { PERMISSIONS } from '../../shared/auth/permissions';
import type { ChangeRequestType, ChangeTargetType } from './api/changeRequests';

// Mirrors the backend TYPE_TARGETS: which kinds of target a type takes.
export const TYPE_TARGETS: Record<
  ChangeRequestType,
  readonly ChangeTargetType[]
> = {
  GRADING_FORMULA: ['COURSE'],
  OUTCOME: ['COURSE', 'PROGRAM'],
  SYLLABUS_CONTENT: ['COURSE'],
  CURRICULUM: ['PROGRAM'],
  COURSE_RELATION: ['COURSE'],
  PROGRAM_INFO: ['PROGRAM'],
  ORGANIZATION: ['SUBJECT_GROUP', 'PROGRAM'],
};

export const DATA_TYPES = [
  'SYLLABUS_CONTENT',
  'OUTCOME',
  'CURRICULUM',
  'COURSE_RELATION',
  'PROGRAM_INFO',
  'GRADING_FORMULA',
] as const satisfies readonly ChangeRequestType[];

export const ORGANIZATION_TYPES = [
  'ORGANIZATION',
] as const satisfies readonly ChangeRequestType[];

// Every type the backend creates is offered; kept as an empty list for the form's disabled-option check.
export const UNSUPPORTED_TYPES: readonly ChangeRequestType[] = [];

// Mirrors the backend editPermissionsFor: a type is offered to someone who holds one of these somewhere.
export const EDIT_PERMISSIONS: Record<
  ChangeRequestType,
  readonly PermissionCode[]
> = {
  GRADING_FORMULA: [PERMISSIONS.gradingFormulaEdit],
  OUTCOME: [PERMISSIONS.ploEdit, PERMISSIONS.cloEdit],
  SYLLABUS_CONTENT: [PERMISSIONS.syllabusEdit],
  CURRICULUM: [PERMISSIONS.curriculumEdit],
  COURSE_RELATION: [PERMISSIONS.courseEdit, PERMISSIONS.courseRelationEdit],
  PROGRAM_INFO: [PERMISSIONS.programEditInfo],
  ORGANIZATION: [PERMISSIONS.changeRequestCreateOrganizational],
};
