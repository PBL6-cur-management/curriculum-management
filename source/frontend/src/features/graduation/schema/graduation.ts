import type { components, operations } from '../../../shared/api/schema';

type Schemas = components['schemas'];
export type GraduationResult = Schemas['GraduationResultDto'];
export type GraduationOutcome =
  operations['GraduationController_live']['responses'][200]['content']['application/json'];
export type GraduationAudit = Schemas['GraduationAuditDto'];
export type GraduationBatch = Schemas['GraduationBatchDto'];
export type GraduationBatchItem = Schemas['GraduationBatchItemDto'];
export type GraduationTask = Schemas['GraduationReauditTaskDto'];
export type GraduationLookup =
  operations['GraduationController_live']['parameters']['query'] & {
    studentId: string;
  };
export type GraduationPage = NonNullable<
  operations['GraduationBatchesController_list']['parameters']['query']
>;
export type GraduationStudentQuery =
  operations['GraduationController_students']['parameters']['query'];
export type GraduationItemQuery = NonNullable<
  operations['GraduationBatchesController_items']['parameters']['query']
>;
export type GraduationExportFilters = NonNullable<
  operations['GraduationBatchesController_export']['parameters']['query']
>;
export type GraduationBatchFilter = Schemas['GraduationBatchFilterDto'];
export type GraduationBatchCreate = Schemas['GraduationBatchCreateDto'];
export type GraduationPreview = Schemas['GraduationBatchPreviewDto'];
export type GraduationAuditPage = Schemas['GraduationAuditPageDto'];
export type GraduationBatchPage = Schemas['GraduationBatchPageDto'];
export type GraduationItemPage = Schemas['GraduationBatchItemPageDto'];
export type GraduationTaskPage = Schemas['GraduationReauditTaskPageDto'];
export type GraduationProgram = Schemas['GraduationProgramOptionDto'];
export type GraduationStudentPage = Schemas['GraduationStudentOptionPageDto'];
