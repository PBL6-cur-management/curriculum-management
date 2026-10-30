export const PDF_QUEUE = 'program-pdf';
export const PDF_JOB = 'render';
// A finished file is kept this long, then the job and its file are dropped.
export const PDF_TTL_MS = 60 * 60 * 1000;
export const PDF_RENDER_TIMEOUT_MS = 60_000;
export const PDF_FILE_DIR = 'program-pdf';
export const DRAFT_MARK = 'BẢN NHÁP';

export const PUBLICATION_RELATIONS = [
  'PRIOR',
  'PREREQUISITE',
  'COREQUISITE',
] as const;
export const PDF_EXPORT_STATES = [
  'QUEUED',
  'RUNNING',
  'READY',
  'FAILED',
  'EXPIRED',
] as const;
export type PdfExportState = (typeof PDF_EXPORT_STATES)[number];

export const HEALTH_CATEGORIES = [
  'CREDIT',
  'REQUISITE_ORDER',
  'REQUISITE_OUTSIDE',
  'EMPTY_SEMESTER',
  'PLO_COVERAGE',
  'ASSESSMENT_CLO',
  'SYLLABUS',
  'REPLACEMENT',
  'OTHER',
] as const;
export type HealthCategory = (typeof HEALTH_CATEGORIES)[number];

// Where the fix lives: the frontend maps each target to a screen of the version.
export const HEALTH_TARGETS = [
  'CURRICULUM',
  'ELECTIVE_GROUPS',
  'VERSION_INFO',
  'COURSE_PLO_MATRIX',
  'ITEM_CLO_PLO',
  'SYLLABUS',
  'COURSE',
] as const;
export type HealthTarget = (typeof HEALTH_TARGETS)[number];
