import {
  ChangeRequestStatus,
  ChangeRequestType,
  ChangeTargetType,
} from '../../generated/prisma/client.js';
import { PERMISSIONS, type PermissionCode } from '../authz/permission-codes.js';

export const WORKSPACE_KIND = {
  PROGRAM_VERSION: 'PROGRAM_VERSION',
  SYLLABUS: 'SYLLABUS',
} as const;
export type WorkspaceKind =
  (typeof WORKSPACE_KIND)[keyof typeof WORKSPACE_KIND];

export const TYPE_TARGETS: Record<
  ChangeRequestType,
  readonly ChangeTargetType[]
> = {
  GRADING_FORMULA: [ChangeTargetType.COURSE],
  OUTCOME: [ChangeTargetType.COURSE, ChangeTargetType.PROGRAM],
  SYLLABUS_CONTENT: [ChangeTargetType.COURSE],
  CURRICULUM: [ChangeTargetType.PROGRAM],
  COURSE_RELATION: [ChangeTargetType.COURSE],
  PROGRAM_INFO: [ChangeTargetType.PROGRAM],
  ORGANIZATION: [ChangeTargetType.SUBJECT_GROUP, ChangeTargetType.PROGRAM],
};

// Which working copy a request owns, if any. COURSE_RELATION and ORGANIZATION store authored items instead.
export function workspaceKindFor(
  type: ChangeRequestType,
  targetType: ChangeTargetType,
): WorkspaceKind | null {
  if (
    type === ChangeRequestType.CURRICULUM ||
    type === ChangeRequestType.PROGRAM_INFO
  ) {
    return WORKSPACE_KIND.PROGRAM_VERSION;
  }
  if (
    type === ChangeRequestType.SYLLABUS_CONTENT ||
    type === ChangeRequestType.GRADING_FORMULA
  ) {
    return WORKSPACE_KIND.SYLLABUS;
  }
  if (type === ChangeRequestType.OUTCOME) {
    return targetType === ChangeTargetType.PROGRAM
      ? WORKSPACE_KIND.PROGRAM_VERSION
      : WORKSPACE_KIND.SYLLABUS;
  }
  return null;
}

// Creating a data request needs the right to edit what it changes, through either path.
export function editPermissionsFor(
  type: ChangeRequestType,
  targetType: ChangeTargetType,
): readonly PermissionCode[] {
  switch (type) {
    case ChangeRequestType.SYLLABUS_CONTENT:
      return [PERMISSIONS.SYLLABUS_EDIT];
    case ChangeRequestType.OUTCOME:
      return targetType === ChangeTargetType.PROGRAM
        ? [PERMISSIONS.PLO_EDIT, PERMISSIONS.CLO_EDIT]
        : [PERMISSIONS.CLO_EDIT];
    case ChangeRequestType.CURRICULUM:
      return [PERMISSIONS.CURRICULUM_EDIT];
    case ChangeRequestType.PROGRAM_INFO:
      return [PERMISSIONS.PROGRAM_EDIT_INFO];
    case ChangeRequestType.COURSE_RELATION:
      return [PERMISSIONS.COURSE_EDIT, PERMISSIONS.COURSE_RELATION_EDIT];
    case ChangeRequestType.ORGANIZATION:
      return [PERMISSIONS.CHANGE_REQUEST_CREATE_ORGANIZATIONAL];
    case ChangeRequestType.GRADING_FORMULA:
      return [PERMISSIONS.GRADING_FORMULA_EDIT];
  }
}

// Open = submitted at least once and not finished (D10); a returned Draft is covered by its round, not listed here.
export const OPEN_REQUEST_STATUSES: readonly ChangeRequestStatus[] = [
  ChangeRequestStatus.PENDING_COORDINATOR,
  ChangeRequestStatus.PENDING_DIRECTOR,
  ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
  ChangeRequestStatus.APPROVED,
];
