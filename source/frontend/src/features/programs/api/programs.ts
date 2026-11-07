import { getJson, sendJson, withQuery } from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

export type ProgramSummary = components['schemas']['ProgramSummaryDto'];
export type ProgramDetail = components['schemas']['ProgramDetailDto'];
export type ProgramPage = components['schemas']['ProgramPageDto'];
export type ProgramVersionRef = components['schemas']['ProgramVersionRefDto'];
export type ProgramReleasedVersion =
  components['schemas']['ProgramReleasedVersionDto'];
export type ProgramCohortRef = components['schemas']['ProgramCohortRefDto'];
export type ProgramVersionInfo = components['schemas']['ProgramVersionInfoDto'];
export type ProgramDirector = components['schemas']['ProgramDirectorDto'];
export type VersionInfoEdit = components['schemas']['VersionInfoEditDto'];
export type UpdateVersionInfoRequest =
  components['schemas']['UpdateVersionInfoDto'];
export type DegreeLevel = components['schemas']['DegreeLevel'];
export type ProgramStatus = components['schemas']['ProgramStatus'];
export type ProgramVersionStatus =
  components['schemas']['ProgramVersionStatus'];
export type CreateProgramRequest = components['schemas']['CreateProgramDto'];
export type UpdateProgramRequest = components['schemas']['UpdateProgramDto'];
export type CloneProgramRequest = components['schemas']['CloneProgramDto'];
export type AssignDirectorRequest = components['schemas']['AssignDirectorDto'];
export type ProgramQuery = NonNullable<
  operations['ProgramsController_list']['parameters']['query']
>;

export const PROGRAMS_PATH = '/programs';
const programPath = (programId: string) =>
  `${PROGRAMS_PATH}/${encodeURIComponent(programId)}`;
const directorPath = (programId: string, assignmentId: string) =>
  `${programPath(programId)}/directors/${encodeURIComponent(assignmentId)}`;

export const PROGRAM_STATUS_ACTION = {
  DEACTIVATE: 'deactivate',
  REACTIVATE: 'reactivate',
} as const;
export type ProgramStatusAction =
  (typeof PROGRAM_STATUS_ACTION)[keyof typeof PROGRAM_STATUS_ACTION];

export const fetchPrograms = (query: ProgramQuery) =>
  getJson<ProgramPage>(withQuery(PROGRAMS_PATH, { ...query }));
export const fetchProgram = (programId: string) =>
  getJson<ProgramDetail>(programPath(programId));
export const updateProgram = (programId: string, body: UpdateProgramRequest) =>
  sendJson<ProgramDetail>('PATCH', programPath(programId), body);
export const changeProgramStatus = (
  programId: string,
  action: ProgramStatusAction,
) => sendJson<ProgramDetail>('POST', `${programPath(programId)}/${action}`);
export const cloneProgram = (programId: string, body: CloneProgramRequest) =>
  sendJson<ProgramDetail>('POST', `${programPath(programId)}/clone`, body);
export const fetchDirectors = (programId: string) =>
  getJson<ProgramDirector[]>(`${programPath(programId)}/directors`);
export const assignDirector = (
  programId: string,
  body: AssignDirectorRequest,
) =>
  sendJson<ProgramDirector>(
    'POST',
    `${programPath(programId)}/directors`,
    body,
  );
export const endDirector = (
  programId: string,
  assignmentId: string,
  validTo: string,
) =>
  sendJson<ProgramDirector>(
    'POST',
    `${directorPath(programId, assignmentId)}/end`,
    {
      validTo,
    },
  );
export const revokeDirector = (programId: string, assignmentId: string) =>
  sendJson<ProgramDirector>(
    'POST',
    `${directorPath(programId, assignmentId)}/revoke`,
  );

// The info of one version by id: the form of a change request's working copy (F-13).
const versionInfoPath = (versionId: string) =>
  `/program-versions/${encodeURIComponent(versionId)}/info`;
export const fetchVersionInfo = (versionId: string) =>
  getJson<VersionInfoEdit>(versionInfoPath(versionId));
export const updateVersionInfo = (
  versionId: string,
  body: UpdateVersionInfoRequest,
) => sendJson<VersionInfoEdit>('PATCH', versionInfoPath(versionId), body);
