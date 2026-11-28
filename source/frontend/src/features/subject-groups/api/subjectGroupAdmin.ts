import { getJson, sendJson } from '../../../shared/api/client';
import {
  SUBJECT_GROUPS_PATH,
  type SubjectGroupSummary,
} from '../../../shared/subject-groups/subjectGroups';
import type { components } from '../../../shared/api/schema';

export type SubjectGroupDetail = components['schemas']['SubjectGroupDetailDto'];
export type SubjectGroupMember = components['schemas']['SubjectGroupMemberDto'];
export type DeactivationImpact =
  components['schemas']['SubjectGroupDeactivationImpactDto'];
export type CreateSubjectGroupRequest =
  components['schemas']['CreateSubjectGroupDto'];
export type UpdateSubjectGroupRequest =
  components['schemas']['UpdateSubjectGroupDto'];
export type AddMemberRequest =
  components['schemas']['AddSubjectGroupMemberDto'];
export type EndMemberRequest =
  components['schemas']['EndSubjectGroupMemberDto'];
export type PromoteCoordinatorRequest =
  components['schemas']['PromoteCoordinatorDto'];
export type DemoteCoordinatorRequest =
  components['schemas']['DemoteCoordinatorDto'];

const groupPath = (groupId: string) =>
  `${SUBJECT_GROUPS_PATH}/${encodeURIComponent(groupId)}`;
const memberPath = (groupId: string, memberId: string) =>
  `${groupPath(groupId)}/members/${encodeURIComponent(memberId)}`;
const coordinatorPath = (groupId: string, lecturerId: string) =>
  `${groupPath(groupId)}/coordinators/${encodeURIComponent(lecturerId)}`;

export const fetchSubjectGroup = (groupId: string) =>
  getJson<SubjectGroupDetail>(groupPath(groupId));
export const createSubjectGroup = (body: CreateSubjectGroupRequest) =>
  sendJson<SubjectGroupSummary>('POST', SUBJECT_GROUPS_PATH, body);
export const updateSubjectGroup = (
  groupId: string,
  body: UpdateSubjectGroupRequest,
) => sendJson<SubjectGroupSummary>('PATCH', groupPath(groupId), body);
export const fetchDeactivationImpact = (groupId: string) =>
  getJson<DeactivationImpact>(`${groupPath(groupId)}/deactivation-impact`);
export const deactivateSubjectGroup = (groupId: string) =>
  sendJson<SubjectGroupSummary>('POST', `${groupPath(groupId)}/deactivate`);
export const activateSubjectGroup = (groupId: string) =>
  sendJson<SubjectGroupSummary>('POST', `${groupPath(groupId)}/activate`);
export const addMember = (groupId: string, body: AddMemberRequest) =>
  sendJson<SubjectGroupMember>('POST', `${groupPath(groupId)}/members`, body);
export const endMember = (
  groupId: string,
  memberId: string,
  body: EndMemberRequest,
) =>
  sendJson<SubjectGroupMember[]>(
    'POST',
    `${memberPath(groupId, memberId)}/end`,
    body,
  );
export const revokeMember = (groupId: string, memberId: string) =>
  sendJson<SubjectGroupMember>(
    'POST',
    `${memberPath(groupId, memberId)}/revoke`,
  );
export const promoteCoordinator = (
  groupId: string,
  lecturerId: string,
  body: PromoteCoordinatorRequest = {},
) =>
  sendJson<SubjectGroupMember>(
    'POST',
    `${coordinatorPath(groupId, lecturerId)}/promote`,
    body,
  );
export const demoteCoordinator = (
  groupId: string,
  lecturerId: string,
  body: DemoteCoordinatorRequest = {},
) =>
  sendJson<SubjectGroupMember[]>(
    'POST',
    `${coordinatorPath(groupId, lecturerId)}/demote`,
    body,
  );
