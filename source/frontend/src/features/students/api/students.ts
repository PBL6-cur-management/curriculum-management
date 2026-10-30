import { getJson, sendJson, withQuery } from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

type Schemas = components['schemas'];
export type StudentSummary = Schemas['StudentSummaryDto'];
export type StudentDetail = Schemas['StudentDetailDto'];
export type StudentEnrollment = Schemas['StudentEnrollmentDto'];
export type AcademicResult = Schemas['AcademicResultDto'];
export type EnrollmentCommand = Schemas['StudentEnrollmentCommandDto'];
export type StudentContext =
  operations['StudentsController_appliedVersion']['parameters']['query'];
export type StudentDetailContext =
  operations['StudentsController_detail']['parameters']['query'];
export type StudentListParams =
  operations['StudentsController_list']['parameters']['query'];
export type StudentResultParams =
  operations['StudentsController_results']['parameters']['query'];

const studentPath = (studentId: string) =>
  `/students/${encodeURIComponent(studentId)}`;
export const fetchStudents = (params: StudentListParams) =>
  getJson<Schemas['StudentPageDto']>(withQuery('/students', params));
export const fetchStudentPrograms = (semesterId: string) =>
  getJson<Schemas['StudentProgramOptionDto'][]>(
    withQuery('/students/program-options', { semesterId }),
  );
export const fetchStudent = (
  studentId: string,
  context: StudentDetailContext,
) => getJson<StudentDetail>(withQuery(studentPath(studentId), context));
export const fetchStudentResults = (
  studentId: string,
  params: StudentResultParams,
) =>
  getJson<Schemas['AcademicResultPageDto']>(
    withQuery(`${studentPath(studentId)}/results`, params),
  );
export const fetchAppliedVersion = (
  studentId: string,
  context: StudentContext,
) =>
  getJson<Schemas['StudentAppliedVersionDto']>(
    withQuery(`${studentPath(studentId)}/applied-version`, context),
  );
export const fetchEnrollmentTargets = (
  studentId: string,
  context: StudentContext,
) =>
  getJson<Schemas['StudentEnrollmentTargetDto'][]>(
    withQuery(`${studentPath(studentId)}/enrollment-targets`, context),
  );
export const createStudentEnrollment = (
  studentId: string,
  body: EnrollmentCommand,
) =>
  sendJson<StudentEnrollment>(
    'POST',
    `${studentPath(studentId)}/enrollments`,
    body,
  );
export const reconcileStudent = (
  studentId: string,
  body: Schemas['ReconcileStudentDto'],
) =>
  sendJson<Schemas['StudentReconciliationDto']>(
    'POST',
    `${studentPath(studentId)}/reconcile-enrollments`,
    body,
  );
