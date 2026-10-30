import {
  downloadFile,
  getJson,
  sendForm,
  sendJson,
  withQuery,
} from '../../../shared/api/client';
import type { components } from '../../../shared/api/schema';

export type CourseSyllabus = components['schemas']['CourseSyllabusDto'];
export type Syllabus = components['schemas']['SyllabusDto'];
export type WeeklyContent = components['schemas']['WeeklyContentDto'];
export type SyllabusAttachment = components['schemas']['SyllabusAttachmentDto'];
export type SyllabusMaterialKind =
  components['schemas']['SyllabusMaterialKind'];
export type AttachmentRules = components['schemas']['AttachmentRulesDto'];
export type AttachmentFileType = components['schemas']['AttachmentFileType'];
export type UpdateSyllabusRequest = components['schemas']['UpdateSyllabusDto'];
export type CreateWeeklyContentRequest =
  components['schemas']['CreateWeeklyContentDto'];
export type UpdateWeeklyContentRequest =
  components['schemas']['UpdateWeeklyContentDto'];
export type Clo = components['schemas']['CloDto'];
export type CreateCloRequest = components['schemas']['CreateCloDto'];
export type UpdateCloRequest = components['schemas']['UpdateCloDto'];
export type GradeFormula = components['schemas']['GradeFormulaDto'];
export type AssessmentComponent =
  components['schemas']['AssessmentComponentDto'];
export type AssessmentCloMapping =
  components['schemas']['AssessmentCloMappingDto'];
export type AssessmentWarning = components['schemas']['AssessmentWarningDto'];
export type ReplaceGradeFormulaRequest =
  components['schemas']['ReplaceGradeFormulaDto'];
export type ReplaceAssessmentMappingsRequest =
  components['schemas']['ReplaceAssessmentMappingsDto'];
export type SyllabusSectionField = keyof UpdateSyllabusRequest;

const coursePath = (courseId: string) =>
  `/courses/${encodeURIComponent(courseId)}/syllabus`;
const syllabusPath = (syllabusId: string) =>
  `/syllabi/${encodeURIComponent(syllabusId)}`;
const weekPath = (weeklyContentId: string) =>
  `/weekly-contents/${encodeURIComponent(weeklyContentId)}`;
const cloPath = (cloId: string) => `/clos/${encodeURIComponent(cloId)}`;
const attachmentPath = (attachmentId: string) =>
  `/syllabus-attachments/${encodeURIComponent(attachmentId)}`;
const ATTACHMENT_FIELD = 'file';

// With a request id the Draft is that request's working copy (F-13); the published revision is unchanged.
export const fetchCourseSyllabus = (
  courseId: string,
  requestId?: string,
  versionId?: string,
) =>
  getJson<CourseSyllabus>(
    withQuery(coursePath(courseId), { requestId, versionId }),
  );
export const createSyllabus = (courseId: string) =>
  sendJson<CourseSyllabus>('POST', coursePath(courseId));
export const updateSyllabus = (
  syllabusId: string,
  body: UpdateSyllabusRequest,
) => sendJson<Syllabus>('PATCH', syllabusPath(syllabusId), body);
export const replaceGradeFormula = (
  syllabusId: string,
  body: ReplaceGradeFormulaRequest,
) =>
  sendJson<GradeFormula>(
    'PUT',
    `${syllabusPath(syllabusId)}/grading-formula`,
    body,
  );
export const replaceAssessmentMappings = (
  syllabusId: string,
  body: ReplaceAssessmentMappingsRequest,
) =>
  sendJson<GradeFormula>(
    'PUT',
    `${syllabusPath(syllabusId)}/assessment-clo-mappings`,
    body,
  );
export const createWeek = (
  syllabusId: string,
  body: CreateWeeklyContentRequest,
) =>
  sendJson<WeeklyContent>(
    'POST',
    `${syllabusPath(syllabusId)}/weekly-contents`,
    body,
  );
export const updateWeek = (
  weeklyContentId: string,
  body: UpdateWeeklyContentRequest,
) => sendJson<WeeklyContent>('PATCH', weekPath(weeklyContentId), body);
export const deleteWeek = (weeklyContentId: string) =>
  sendJson<void>('DELETE', weekPath(weeklyContentId));
export const reorderWeeks = (syllabusId: string, ids: string[]) =>
  sendJson<WeeklyContent[]>(
    'PUT',
    `${syllabusPath(syllabusId)}/weekly-contents/order`,
    { ids },
  );
export const createClo = (syllabusId: string, body: CreateCloRequest) =>
  sendJson<Clo>('POST', `${syllabusPath(syllabusId)}/clos`, body);
export const updateClo = (cloId: string, body: UpdateCloRequest) =>
  sendJson<Clo>('PATCH', cloPath(cloId), body);
export const deleteClo = (cloId: string) =>
  sendJson<void>('DELETE', cloPath(cloId));
export const reorderClos = (syllabusId: string, ids: string[]) =>
  sendJson<Clo[]>('PUT', `${syllabusPath(syllabusId)}/clos/order`, { ids });
export function uploadAttachment(
  syllabusId: string,
  file: File,
  materialKind: SyllabusMaterialKind,
): Promise<SyllabusAttachment> {
  const form = new FormData();
  form.append(ATTACHMENT_FIELD, file);
  form.append('materialKind', materialKind);
  return sendForm<SyllabusAttachment>(
    `${syllabusPath(syllabusId)}/attachments`,
    form,
  );
}
export const deleteAttachment = (attachmentId: string) =>
  sendJson<void>('DELETE', attachmentPath(attachmentId));
export const downloadAttachment = (attachment: SyllabusAttachment) =>
  downloadFile(`${attachmentPath(attachment.id)}/file`, attachment.fileName);
