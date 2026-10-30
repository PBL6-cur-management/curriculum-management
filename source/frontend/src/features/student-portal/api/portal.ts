import { downloadFile, getJson, withQuery } from '../../../shared/api/client';
import type { components } from '../../../shared/api/schema';

type Schemas = components['schemas'];
export type PortalMe = Schemas['PortalMeDto'];
export type PortalProgram = Schemas['PortalProgramDto'];
export type PortalCurriculum = Schemas['PortalCurriculumDto'];
export type PortalCourse = Schemas['PortalCourseDto'];
export type PortalCourseState = Schemas['PortalCourseState'];
export type PortalPlo = Schemas['PortalPloDto'];
export type PortalSyllabus = Schemas['PortalSyllabusDto'];
export type PortalAttachment = Schemas['PortalAttachmentDto'];

// The program and calendar semester a page is read for; the student is always the session.
export interface PortalContext {
  studentId: string;
  programId: string;
  semesterId: string;
}

const scope = (context: PortalContext) => ({
  programId: context.programId,
  semesterId: context.semesterId,
});
const itemPath = (itemId: string) =>
  `/portal/curriculum-items/${encodeURIComponent(itemId)}/syllabus`;

export const fetchPortalMe = (semesterId?: string) =>
  getJson<PortalMe>(withQuery('/portal/me', { semesterId }));
export const fetchPortalCurriculum = (context: PortalContext) =>
  getJson<PortalCurriculum>(withQuery('/portal/curriculum', scope(context)));
export const fetchPortalPlos = (context: PortalContext) =>
  getJson<PortalPlo[]>(withQuery('/portal/plos', scope(context)));
export const fetchPortalSyllabus = (context: PortalContext, itemId: string) =>
  getJson<PortalSyllabus>(withQuery(itemPath(itemId), scope(context)));
export const downloadPortalAttachment = (
  context: PortalContext,
  itemId: string,
  attachment: PortalAttachment,
) =>
  downloadFile(
    withQuery(
      `${itemPath(itemId)}/attachments/${encodeURIComponent(attachment.id)}/file`,
      scope(context),
    ),
    attachment.fileName,
  );
