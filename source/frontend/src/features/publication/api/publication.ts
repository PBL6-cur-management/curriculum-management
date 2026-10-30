import type { components } from '../../../shared/api/schema';
import { downloadFile, getJson, sendJson } from '../../../shared/api/client';

type Schemas = components['schemas'];
export type CourseGraph = Schemas['CourseGraphDto'];
export type GraphNode = Schemas['GraphNodeDto'];
export type GraphEdge = Schemas['GraphEdgeDto'];
export type ProgramTimeline = Schemas['ProgramTimelineDto'];
export type TimelineEvent = Schemas['TimelineEventDto'];
export type ProgramHealth = Schemas['ProgramHealthDto'];
export type HealthIssue = Schemas['HealthIssueDto'];
export type HealthCategory = Schemas['HealthCategory'];
export type HealthTarget = Schemas['HealthTarget'];
export type ProgramPdfExport = Schemas['ProgramPdfExportDto'];

const versionPath = (programId: string, versionId: string) =>
  `/programs/${encodeURIComponent(programId)}/versions/${encodeURIComponent(versionId)}`;
const exportPath = (exportId: string) =>
  `/program-pdf-exports/${encodeURIComponent(exportId)}`;

export const fetchCourseGraph = (programId: string, versionId: string) =>
  getJson<CourseGraph>(`${versionPath(programId, versionId)}/course-graph`);
export const fetchProgramHealth = (programId: string, versionId: string) =>
  getJson<ProgramHealth>(`${versionPath(programId, versionId)}/health`);
export const fetchVersionTimeline = (programId: string) =>
  getJson<ProgramTimeline>(
    `/programs/${encodeURIComponent(programId)}/version-timeline`,
  );
export const createPdfExport = (programId: string, versionId: string) =>
  sendJson<ProgramPdfExport>(
    'POST',
    `${versionPath(programId, versionId)}/pdf-exports`,
  );
export const fetchPdfExport = (exportId: string) =>
  getJson<ProgramPdfExport>(exportPath(exportId));
export const downloadPdfExport = (exportId: string, fileName: string) =>
  downloadFile(`${exportPath(exportId)}/file`, fileName);
