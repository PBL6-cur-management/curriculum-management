import { downloadFile, getJson, sendJson } from '../../../shared/api/client';
import type { components } from '../../../shared/api/schema';

export type Curriculum = components['schemas']['CurriculumDto'];
export type CurriculumItem = components['schemas']['CurriculumItemDto'];
export type CurriculumRequisite =
  components['schemas']['CurriculumRequisiteDto'];
export type CurriculumWarning = components['schemas']['CurriculumWarningDto'];
export type ElectiveGroup = components['schemas']['ElectiveGroupDto'];
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

const versionPath = (versionId: string) =>
  `/program-versions/${encodeURIComponent(versionId)}`;
const itemPath = (itemId: string) =>
  `/curriculum-items/${encodeURIComponent(itemId)}`;
const groupPath = (groupId: string) =>
  `/elective-groups/${encodeURIComponent(groupId)}`;

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
