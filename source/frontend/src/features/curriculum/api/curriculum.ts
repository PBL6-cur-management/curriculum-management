import { downloadFile, getJson, sendJson } from '../../../shared/api/client';
import type { components } from '../../../shared/api/schema';

export type Curriculum = components['schemas']['CurriculumDto'];
export type CurriculumItem = components['schemas']['CurriculumItemDto'];
export type CurriculumRequisite =
  components['schemas']['CurriculumRequisiteDto'];
export type CurriculumWarning = components['schemas']['CurriculumWarningDto'];
export type ElectiveGroup = components['schemas']['ElectiveGroupDto'];
export type ProgramTrack = components['schemas']['ProgramTrackDto'] & {
  studentCount?: number;
};
export type ProgramTrackRef = components['schemas']['ProgramTrackRefDto'];
export type BulkAssignTrackMode = 'MOVE' | 'COPY';
export interface BulkAssignTrackItemsRequest {
  itemIds: string[];
  trackIds: string[];
  mode: BulkAssignTrackMode;
  isElective?: boolean;
}
export interface BulkAssignTrackResult {
  updated: number;
  created: number;
  skipped: number;
}
export type SemesterTotal = components['schemas']['SemesterTotalDto'];
export type BlockTotal = components['schemas']['BlockTotalDto'];
export type KnowledgeBlock = components['schemas']['KnowledgeBlockDto'];
export type CurriculumRequisiteType =
  components['schemas']['CurriculumRequisiteType'];
export type CreateCurriculumItemRequest =
  components['schemas']['CreateCurriculumItemDto'];
export type UpdateCurriculumItemRequest =
  components['schemas']['UpdateCurriculumItemDto'];
export type ReorderCurriculumRequest =
  components['schemas']['ReorderCurriculumDto'];
export type ReplaceRequisitesRequest =
  components['schemas']['ReplaceRequisitesDto'];
export type CreateElectiveGroupRequest =
  components['schemas']['CreateElectiveGroupDto'];
export type UpdateElectiveGroupRequest =
  components['schemas']['UpdateElectiveGroupDto'];
export type CreateProgramTrackRequest =
  components['schemas']['CreateProgramTrackDto'];
export type UpdateProgramTrackRequest =
  components['schemas']['UpdateProgramTrackDto'];

const versionPath = (versionId: string) =>
  `/program-versions/${encodeURIComponent(versionId)}`;
const itemPath = (itemId: string) =>
  `/curriculum-items/${encodeURIComponent(itemId)}`;
const groupPath = (groupId: string) =>
  `/elective-groups/${encodeURIComponent(groupId)}`;
const trackPath = (trackId: string) =>
  `/program-tracks/${encodeURIComponent(trackId)}`;

export const fetchCurriculum = (versionId: string) =>
  getJson<Curriculum>(`${versionPath(versionId)}/curriculum`);
export const exportCurriculum = (versionId: string) =>
  downloadFile(
    `${versionPath(versionId)}/curriculum/export`,
    'Khung-chuong-trinh.xlsx',
  );
export const createItem = (
  versionId: string,
  body: CreateCurriculumItemRequest,
) =>
  sendJson<CurriculumItem>(
    'POST',
    `${versionPath(versionId)}/curriculum-items`,
    body,
  );
export const updateItem = (itemId: string, body: UpdateCurriculumItemRequest) =>
  sendJson<CurriculumItem>('PATCH', itemPath(itemId), body);
export const deleteItem = (itemId: string) =>
  sendJson<void>('DELETE', itemPath(itemId));
export const reorderSemester = (
  versionId: string,
  body: ReorderCurriculumRequest,
) => sendJson<void>('PUT', `${versionPath(versionId)}/curriculum-order`, body);
export const replaceRequisites = (
  itemId: string,
  body: ReplaceRequisitesRequest,
) => sendJson<CurriculumItem>('PUT', `${itemPath(itemId)}/requisites`, body);
export const createGroup = (
  versionId: string,
  body: CreateElectiveGroupRequest,
) =>
  sendJson<ElectiveGroup>(
    'POST',
    `${versionPath(versionId)}/elective-groups`,
    body,
  );
export const updateGroup = (
  groupId: string,
  body: UpdateElectiveGroupRequest,
) => sendJson<ElectiveGroup>('PATCH', groupPath(groupId), body);
export const deleteGroup = (groupId: string) =>
  sendJson<void>('DELETE', groupPath(groupId));
export const assignGroupItems = (groupId: string, itemIds: string[]) =>
  sendJson<ElectiveGroup>('PUT', `${groupPath(groupId)}/items`, { itemIds });

export const fetchTracks = (versionId: string) =>
  getJson<ProgramTrack[]>(`${versionPath(versionId)}/tracks`);
export const createTrack = (
  versionId: string,
  body: CreateProgramTrackRequest,
) => sendJson<ProgramTrack>('POST', `${versionPath(versionId)}/tracks`, body);
export const updateTrack = (trackId: string, body: UpdateProgramTrackRequest) =>
  sendJson<ProgramTrack>('PATCH', trackPath(trackId), body);
export const deleteTrack = (trackId: string) =>
  sendJson<void>('DELETE', trackPath(trackId));
export const bulkAssignTrackItems = (
  versionId: string,
  body: BulkAssignTrackItemsRequest,
) =>
  sendJson<BulkAssignTrackResult>(
    'POST',
    `${versionPath(versionId)}/tracks/bulk-assign`,
    body,
  );
