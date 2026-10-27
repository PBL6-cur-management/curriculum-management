import { DIFF_FIELD_LABELS } from '../../shared/change-requests/diff/diff-labels.js';
import type { VersionCompareSection } from './dto/version-comparison.dto.js';

export const RELEASED_SNAPSHOT_ENTITY = {
  PINNED_SYLLABUS: 'PINNED_SYLLABUS',
} as const;
export const RELEASED_VERSION_INFO_FIELDS = [
  'programName',
  'majorCode',
  'majorName',
  'semesterCount',
  'totalCredits',
  'compulsoryCredits',
  'electiveCredits',
  'creditMismatchReason',
] as const;
export const VERSION_COMPARE_TITLES: Record<VersionCompareSection, string> = {
  INFO: 'Thông tin chương trình',
  CURRICULUM: 'Khung chương trình',
  ELECTIVE_GROUPS: 'Nhóm tự chọn',
  PLOS: 'Chuẩn đầu ra chương trình (PLO)',
  MATRICES: 'Ma trận chuẩn đầu ra',
  SYLLABI: 'Đề cương được ghim',
};
export const VERSION_COMPARE_FIELDS: Record<string, string> = {
  ...DIFF_FIELD_LABELS,
  courseName: 'Tên học phần',
  credits: 'Số tín chỉ',
  syllabusId: 'Bản đề cương',
  revisionNumber: 'Số bản đề cương',
};
export const VERSION_COMPARE_ENTITIES: Record<string, VersionCompareSection> = {
  VERSION_INFO: 'INFO',
  CURRICULUM_ITEM: 'CURRICULUM',
  CURRICULUM_REQUISITE: 'CURRICULUM',
  ELECTIVE_GROUP: 'ELECTIVE_GROUPS',
  PLO: 'PLOS',
  COURSE_PLO: 'MATRICES',
  CLO_PLO: 'MATRICES',
  PINNED_SYLLABUS: 'SYLLABI',
};
export const VERSION_COMPARE_ENTITY_ORDER = [
  'VERSION_INFO',
  'CURRICULUM_ITEM',
  'CURRICULUM_REQUISITE',
  'ELECTIVE_GROUP',
  'PLO',
  'COURSE_PLO',
  'CLO_PLO',
  'PINNED_SYLLABUS',
];
