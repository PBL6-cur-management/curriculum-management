import {
  downloadFile,
  getJson,
  sendForm,
  sendJson,
  withQuery,
} from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

type Schemas = components['schemas'];

export type ChangeRequestSummary = Schemas['ChangeRequestSummaryDto'];
export type ChangeRequestDetail = Schemas['ChangeRequestDetailDto'];
export type ChangeRequestPage = Schemas['ChangeRequestPageDto'];
export type ChangeRequestStatus = Schemas['ChangeRequestStatus'];
export type ChangeRequestType = Schemas['ChangeRequestType'];
export type ChangeTargetType = Schemas['ChangeTargetType'];
export type RequestOrigin = Schemas['RequestOrigin'];
export type ChangeDocumentType = Schemas['ChangeDocumentType'];
export type ChangeRequestDocument = Schemas['ChangeRequestDocumentDto'];
export type ApprovalStep = Schemas['ApprovalStepDto'];
export type ApprovalAction = Schemas['ApprovalAction'];
export type ApprovalStepKind = Schemas['ApprovalStepKind'];
export type OverrideAction = Schemas['OverrideAction'];
export type OverrideDecisionBody = Schemas['OverrideDecisionDto'];
export type ApprovalHistory = Schemas['ApprovalHistoryDto'];
export type FinalApprovalPreview = Schemas['FinalApprovalPreviewDto'];
export type FinalApprovalProgram = Schemas['FinalApprovalProgramDto'];
export type FinalApproveInput = Schemas['FinalApproveDto'];
export type RequestRelease = NonNullable<ChangeRequestDetail['release']>;
export type ApprovalRound = Schemas['ApprovalRoundDto'];
export type ChangeRequestComment = Schemas['CommentDto'];
export type ApprovalQueueItem = Schemas['ApprovalQueueItemDto'];
export type ApprovalQueueQuery = NonNullable<
  operations['ApprovalQueueController_read']['parameters']['query']
>;
export type Conflict = Schemas['ConflictDto'];
export type RequestWorkspace = Schemas['RequestWorkspaceDto'];
export type AuthoredItem = Schemas['AuthoredItemDto'];
export type ChangeDiff = Schemas['ChangeDiffDto'];
export type DiffSection = Schemas['DiffSectionDto'];
export type SubmitPreview = Schemas['SubmitPreviewDto'];
export type CreateChangeRequestBody = Schemas['CreateChangeRequestDto'];
export type UpdateChangeRequestBody = Schemas['UpdateChangeRequestDto'];
export type ChangeRequestQuery = NonNullable<
  operations['ChangeRequestsController_list']['parameters']['query']
>;
export type AuthoredItemInput =
  | {
      operation: 'SET_COURSE_FIELD';
      field: CourseRequestField;
      value: string | null;
    }
  | {
      operation: 'ADD_RELATION';
      sourceCourseId: string;
      targetCourseId: string;
      relationType: RelationType;
      minScore: string | null;
    }
  | {
      operation: 'UPDATE_RELATION';
      relationId: string;
      minScore: string | null;
    }
  | { operation: 'REMOVE_RELATION'; relationId: string }
  | {
      operation: 'ADD_MEMBER';
      lecturerId: string;
      memberRole: 'MEMBER' | 'COORDINATOR';
      validFrom: string;
      validTo: string | null;
    }
  | { operation: 'END_MEMBERSHIP'; memberRowId: string; validTo: string }
  | {
      operation: 'ASSIGN_DIRECTOR';
      directorId: string;
      validFrom: string;
      validTo: string | null;
    }
  | { operation: 'END_DIRECTOR'; assignmentId: string; validTo: string };
export type CourseRequestField =
  'courseName' | 'englishName' | 'credits' | 'courseType' | 'ownerGroupId';
export type RelationType = Schemas['CourseRelationType'];

export interface TargetOption {
  id: string;
  code: string;
  name: string;
}

const REQUESTS = '/change-requests';
const requestPath = (id: string) => `${REQUESTS}/${encodeURIComponent(id)}`;
const documentPath = (id: string) =>
  `/change-request-documents/${encodeURIComponent(id)}`;
export const USER_OPTIONS_PATH = `${REQUESTS}/user-options`;
export const TARGET_OPTIONS_PAGE_SIZE = 20;

export const listChangeRequests = (query: ChangeRequestQuery) =>
  getJson<ChangeRequestPage>(withQuery(REQUESTS, { ...query }));
export const getChangeRequest = (id: string) =>
  getJson<ChangeRequestDetail>(requestPath(id));
export const getConflicts = (targetType: ChangeTargetType, targetId: string) =>
  getJson<Conflict[]>(
    withQuery(`${REQUESTS}/conflicts`, { targetType, targetId }),
  );
export const createChangeRequest = (body: CreateChangeRequestBody) =>
  sendJson<ChangeRequestDetail>('POST', REQUESTS, body);
export const updateChangeRequest = (
  id: string,
  body: UpdateChangeRequestBody,
) => sendJson<ChangeRequestDetail>('PATCH', requestPath(id), body);
export const deleteChangeRequest = (id: string) =>
  sendJson<void>('DELETE', requestPath(id));
export const rebaseChangeRequest = (id: string) =>
  sendJson<ChangeRequestDetail>('POST', `${requestPath(id)}/rebase`);
export const replaceAuthoredItems = (id: string, items: AuthoredItemInput[]) =>
  sendJson<ChangeRequestDetail>('PUT', `${requestPath(id)}/items`, { items });
export const getDiff = (id: string) =>
  getJson<ChangeDiff>(`${requestPath(id)}/diff`);
export const getSubmitPreview = (id: string) =>
  getJson<SubmitPreview>(`${requestPath(id)}/submit-preview`);
export const submitChangeRequest = (id: string) =>
  sendJson<ChangeRequestDetail>('POST', `${requestPath(id)}/submit`);
export const withdrawChangeRequest = (id: string) =>
  sendJson<ChangeRequestDetail>('POST', `${requestPath(id)}/withdraw`);

export const approveChangeRequest = (id: string, remark?: string) =>
  sendJson<ChangeRequestDetail>('POST', `${requestPath(id)}/approve`, {
    remark,
  });
// MH-43: the decision number and the semester turn a level-3 data request into released versions (F-15).
export const fetchFinalApproval = (id: string) =>
  getJson<FinalApprovalPreview>(`${requestPath(id)}/final-approval`);
export const finalApproveChangeRequest = (
  id: string,
  body: FinalApproveInput,
) =>
  sendJson<ChangeRequestDetail>(
    'POST',
    `${requestPath(id)}/final-approve`,
    body,
  );
export const returnChangeRequest = (id: string, remark: string) =>
  sendJson<ChangeRequestDetail>('POST', `${requestPath(id)}/return`, {
    remark,
  });
export const rejectChangeRequest = (id: string, remark: string) =>
  sendJson<ChangeRequestDetail>('POST', `${requestPath(id)}/reject`, {
    remark,
  });
export const overrideChangeRequest = (id: string, body: OverrideDecisionBody) =>
  sendJson<ChangeRequestDetail>('POST', `${requestPath(id)}/override`, body);
export const getApprovalHistory = (id: string) =>
  getJson<ApprovalHistory>(`${requestPath(id)}/history`);
export const listComments = (id: string) =>
  getJson<ChangeRequestComment[]>(`${requestPath(id)}/comments`);
export const createComment = (id: string, content: string) =>
  sendJson<ChangeRequestComment>('POST', `${requestPath(id)}/comments`, {
    content,
  });
export const getApprovalQueue = (query: ApprovalQueueQuery) =>
  getJson<ApprovalQueueItem[]>(withQuery('/approval-queue', { ...query }));

export function uploadDocument(
  id: string,
  documentType: ChangeDocumentType,
  file: File,
) {
  const form = new FormData();
  form.append('documentType', documentType);
  form.append('file', file);
  return sendForm<ChangeRequestDocument>(`${requestPath(id)}/documents`, form);
}
export const removeDocument = (documentId: string) =>
  sendJson<void>('DELETE', documentPath(documentId));
export const downloadDocument = (document: ChangeRequestDocument) =>
  downloadFile(`${documentPath(document.id)}/file`, document.fileName);

// The target pickers read other features' list endpoints directly; this feature never imports their code.
export async function searchPrograms(q: string, page = 1) {
  const result = await getJson<Schemas['ProgramPageDto']>(
    withQuery('/programs', {
      q,
      page: page === 1 ? undefined : page,
      pageSize: TARGET_OPTIONS_PAGE_SIZE,
    }),
  );
  return {
    ...result,
    items: result.items.map((program): TargetOption => ({
      id: program.id,
      code: program.programCode,
      name: program.programName,
    })),
  };
}

export async function listSubjectGroups(): Promise<TargetOption[]> {
  const groups = await getJson<Schemas['SubjectGroupSummaryDto'][]>(
    withQuery('/subject-groups', { status: 'ACTIVE' }),
  );
  return groups.map((group) => ({
    id: group.id,
    code: group.groupCode,
    name: group.groupName,
  }));
}

// The editors of authored items read what they change from the owning features' endpoints (never their code).
export type CourseInfo = Schemas['CourseDetailDto'];
export type CourseRelationRow = Schemas['CourseRelationDto'];
export type GroupDetail = Schemas['SubjectGroupDetailDto'];
export type DirectorRow = Schemas['ProgramDirectorDto'];

export const fetchCourseInfo = (courseId: string) =>
  getJson<CourseInfo>(`/courses/${encodeURIComponent(courseId)}`);
export const fetchCourseRelationRows = (courseId: string) =>
  getJson<CourseRelationRow[]>(
    `/courses/${encodeURIComponent(courseId)}/relations`,
  );
export const fetchGroupDetail = (groupId: string) =>
  getJson<GroupDetail>(`/subject-groups/${encodeURIComponent(groupId)}`);
export const fetchProgramDirectors = (programId: string) =>
  getJson<DirectorRow[]>(
    `/programs/${encodeURIComponent(programId)}/directors`,
  );

// "CODE — name" of the target a link prefilled, so the picker shows more than an id.
export async function fetchTargetLabel(
  targetType: ChangeTargetType,
  targetId: string,
): Promise<string> {
  if (targetType === 'COURSE') {
    const course = await fetchCourseInfo(targetId);
    return `${course.courseCode} — ${course.courseName}`;
  }
  if (targetType === 'PROGRAM') {
    const program = await getJson<Schemas['ProgramDetailDto']>(
      `/programs/${encodeURIComponent(targetId)}`,
    );
    return `${program.programCode} — ${program.programName}`;
  }
  const group = await fetchGroupDetail(targetId);
  return `${group.groupCode} — ${group.groupName}`;
}
