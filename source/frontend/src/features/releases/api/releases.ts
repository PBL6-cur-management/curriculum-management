import { getJson, sendJson, withQuery } from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

type Schemas = components['schemas'];

export type SemesterInput = Schemas['CreateSemesterDto'];
export type SemesterPatch = Schemas['UpdateSemesterDto'];
export type CohortInput = Schemas['CreateCohortDto'];
export type CohortPatch = Schemas['UpdateCohortDto'];
export type ReleaseCheck = Schemas['ReleaseCheckDto'];
export type SyllabusReleaseIssue = Schemas['SyllabusReleaseIssueDto'];
export type ReleaseVersionInput = Schemas['ReleaseVersionDto'];
export type IssueCorrectionInput = Schemas['IssueCorrectionDto'];
export type VersionRef = Schemas['VersionRefDto'];
export type VersionList = Schemas['VersionListDto'];
export type VersionDetail = Schemas['VersionDetailDto'];
export type VersionRow = Schemas['VersionRowDto'];
export type VersionComparison = Schemas['VersionComparisonDto'];
export type PinnedSyllabusComparison = Schemas['PinnedSyllabusComparisonDto'];
export type CohortVersionList = Schemas['CohortVersionListDto'];
export type CohortVersionAssignment = Schemas['CohortVersionAssignmentDto'];
export type AppliedCohortVersion = Schemas['AppliedCohortVersionDto'];
export type AssignCohortVersionsInput = Schemas['AssignCohortVersionsDto'];
export type UpdateCohortVersionInput = Schemas['UpdateCohortVersionDto'];
export type AssignmentProgramPage = Schemas['ProgramPageDto'];
export type AssignmentProgramQuery = NonNullable<
  operations['ProgramsController_list']['parameters']['query']
>;

export const fetchAssignmentPrograms = (query: AssignmentProgramQuery) =>
  getJson<AssignmentProgramPage>(withQuery('/programs', { ...query }));
export const fetchVersionComparison = (
  programId: string,
  beforeVersionId: string,
  afterVersionId: string,
) =>
  getJson<VersionComparison>(
    withQuery(`${programPath(programId)}/version-comparison`, {
      beforeVersionId,
      afterVersionId,
    }),
  );
export const fetchPinnedSyllabusComparison = (
  programId: string,
  courseId: string,
  beforeVersionId: string,
  afterVersionId: string,
) =>
  getJson<PinnedSyllabusComparison>(
    withQuery(
      `${programPath(programId)}/version-comparison/syllabi/${encodeURIComponent(courseId)}`,
      { beforeVersionId, afterVersionId },
    ),
  );
export const fetchCohortVersions = (programId: string) =>
  getJson<CohortVersionList>(`${programPath(programId)}/cohort-versions`);
export const assignCohortVersions = (
  programId: string,
  body: AssignCohortVersionsInput,
) =>
  sendJson<CohortVersionList>(
    'POST',
    `${programPath(programId)}/cohort-versions`,
    body,
  );
export const updateCohortVersion = (
  programId: string,
  assignmentId: string,
  body: UpdateCohortVersionInput,
) =>
  sendJson<CohortVersionList>(
    'PATCH',
    `${programPath(programId)}/cohort-versions/${encodeURIComponent(assignmentId)}`,
    body,
  );
export const fetchAppliedCohortVersion = (
  programId: string,
  cohortId: string,
  semesterId: string,
) =>
  getJson<AppliedCohortVersion>(
    withQuery(
      `${programPath(programId)}/cohorts/${encodeURIComponent(cohortId)}/applied-version`,
      { semesterId },
    ),
  );

const programPath = (programId: string) =>
  `/programs/${encodeURIComponent(programId)}`;
const versionPath = (programId: string, versionId: string) =>
  `${programPath(programId)}/versions/${encodeURIComponent(versionId)}`;
const correctionPath = (
  programId: string,
  versionId: string,
  correctionId: string,
) =>
  `${versionPath(programId, versionId)}/corrections/${encodeURIComponent(correctionId)}`;

export const createSemester = (body: SemesterInput) =>
  sendJson<Schemas['SemesterDto']>('POST', '/semesters', body);
export const updateSemester = (id: string, body: SemesterPatch) =>
  sendJson<Schemas['SemesterDto']>(
    'PATCH',
    `/semesters/${encodeURIComponent(id)}`,
    body,
  );
export const createCohort = (body: CohortInput) =>
  sendJson<Schemas['CohortDto']>('POST', '/cohorts', body);
export const updateCohort = (id: string, body: CohortPatch) =>
  sendJson<Schemas['CohortDto']>(
    'PATCH',
    `/cohorts/${encodeURIComponent(id)}`,
    body,
  );

export const fetchReleaseCheck = (programId: string, versionId: string) =>
  getJson<ReleaseCheck>(`${versionPath(programId, versionId)}/release-check`);
export const releaseVersion = (
  programId: string,
  versionId: string,
  body: ReleaseVersionInput,
) =>
  sendJson<VersionDetail>(
    'POST',
    `${versionPath(programId, versionId)}/release`,
    body,
  );

export const fetchVersionHistory = (programId: string) =>
  getJson<VersionList>(`${programPath(programId)}/versions`);
export const fetchVersionDetail = (programId: string, versionId: string) =>
  getJson<VersionDetail>(versionPath(programId, versionId));

export const openCorrection = (programId: string, versionId: string) =>
  sendJson<VersionDetail>(
    'POST',
    `${versionPath(programId, versionId)}/corrections`,
  );
export const issueCorrection = (
  programId: string,
  versionId: string,
  correctionId: string,
  body: IssueCorrectionInput,
) =>
  sendJson<VersionDetail>(
    'POST',
    `${correctionPath(programId, versionId, correctionId)}/issue`,
    body,
  );
export const discardCorrection = (
  programId: string,
  versionId: string,
  correctionId: string,
) =>
  sendJson<void>('DELETE', correctionPath(programId, versionId, correctionId));
