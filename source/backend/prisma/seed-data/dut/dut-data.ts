import type {
  DutCohort,
  DutCourse,
  DutSemester,
  DutUnit,
} from './extract/extract-catalog.js';
import type { DutProgram, FrameReport } from './extract/extract-frames.js';
import type { DutRelation } from './extract/extract-relations.js';
import type { ProgramFrames } from './extract/program-map.js';
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
  scope: {
    frames: number;
    // Thạc sĩ / tiến sĩ frames: outside the SRS degree levels, so neither they nor their students are seeded.
    excludedFramesWithStudents: {
      frameCode: string;
      level: string;
      students: number;
    }[];
  };
  // Frame → program mapping by rule, for the Khoa to confirm.
  programs: ProgramFrames[];
  missingCourseCodes: string[];
  ownersInferredFromCode: number;
  estimatedSemesters: string[];
  nextTermCode: string;
  conflictingRelationPairs: number;
  excludedRelationPairs: number;
  cycleSkippedRelations: DutRelation[];
  frames: FrameReport[];
}
