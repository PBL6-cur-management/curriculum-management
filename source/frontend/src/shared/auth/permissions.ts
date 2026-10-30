import type { components } from '../api/schema';
import type { Me } from './me';

export type PermissionCode = components['schemas']['PermissionCode'];

export const PERMISSIONS = {
  studentViewRegistrationEligibility: 'student.viewRegistrationEligibility',
  versionCompare: 'version.compare',
  versionAssignCohort: 'version.assignCohort',
  userManage: 'user.manage',
  permissionView: 'permission.view',
  permissionManage: 'permission.manage',
  orgUnitManage: 'orgUnit.manage',
  subjectGroupView: 'subjectGroup.view',
  courseView: 'course.view',
  courseEdit: 'course.edit',
  courseRelationEdit: 'courseRelation.edit',
  programView: 'program.view',
  programEditInfo: 'program.editInfo',
  programClone: 'program.clone',
  curriculumEdit: 'curriculum.edit',
  directorAssign: 'director.assign',
  syllabusView: 'syllabus.view',
  syllabusEdit: 'syllabus.edit',
  gradingFormulaEdit: 'gradingFormula.edit',
  outcomeView: 'outcome.view',
  ploEdit: 'plo.edit',
  cloEdit: 'clo.edit',
  changeRequestView: 'changeRequest.view',
  changeRequestCreate: 'changeRequest.create',
  changeRequestCreateOrganizational: 'changeRequest.createOrganizational',
  changeRequestOverride: 'changeRequest.override',
  changeRequestComment: 'changeRequest.comment',
  versionPublish: 'version.publish',
  versionCorrect: 'version.correct',
  versionViewHistory: 'version.viewHistory',
  semesterManage: 'semester.manage',
  dataImportExcel: 'data.importExcel',
  curriculumImportExportExcel: 'curriculum.importExportExcel',
} as const satisfies Record<string, PermissionCode>;

export function hasPermission(
  me: Me | null | undefined,
  code: PermissionCode,
): boolean {
  return me?.permissions.includes(code) ?? false;
}
