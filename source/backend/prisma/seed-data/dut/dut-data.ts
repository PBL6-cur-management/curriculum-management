import type {
  CatalogExtract,
  DutCohort,
  DutCourse,
  DutSemester,
  DutUnit,
} from './extract/extract-catalog.js';
import type { DutProgram, FrameReport } from './extract/extract-frames.js';
import type { DutRelation } from './extract/extract-relations.js';
export type {
  CatalogExtract,
  DutCohort,
  DutCourse,
  DutSemester,
  DutUnit,
} from './extract/extract-catalog.js';
export type {
  DutGroup,
  DutItem,
  DutProgram,
  DutRequisite,
  DutVersion,
  FrameReport,
} from './extract/extract-frames.js';
export type { DutRelation } from './extract/extract-relations.js';
export const DUT_DATA_FILES = {
  CATALOG: 'catalog.json',
  PROGRAMS: 'programs.json',
  REPORT: 'report.json',
} as const;
export const DEFAULT_LEGACY_ROOT = '../current-data-dut/pbl6-data';
export interface DutCatalogFile {
  units: DutUnit[];
  courses: DutCourse[];
  semesters: DutSemester[];
  cohorts: DutCohort[];
  relations: DutRelation[];
}
export interface DutProgramsFile {
  programs: DutProgram[];
}
export interface DutReportFile {
  malformedLines: Record<string, number>;
  missingCourseCodes: string[];
  snapshotConflicts: CatalogExtract['snapshotConflicts'];
  conflictingRelationPairs: number;
  excludedRelationPairs: number;
  cycleSkippedRelations: DutRelation[];
  frames: FrameReport[];
}
