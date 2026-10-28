import { SNAPSHOT_ENTITY } from './snapshot-entry.js';
import { AUTHORED_ENTITY } from '../authored-item.types.js';

// Sections of the diff in reading order: the program first, then the syllabus, then the authored items.
export const DIFF_SECTION_ORDER: readonly string[] = [
  SNAPSHOT_ENTITY.VERSION_INFO,
  SNAPSHOT_ENTITY.ELECTIVE_GROUP,
  SNAPSHOT_ENTITY.CURRICULUM_ITEM,
  SNAPSHOT_ENTITY.CURRICULUM_REQUISITE,
  SNAPSHOT_ENTITY.PLO,
  SNAPSHOT_ENTITY.COURSE_PLO,
  SNAPSHOT_ENTITY.CLO_PLO,
  SNAPSHOT_ENTITY.SYLLABUS_FIELD,
  SNAPSHOT_ENTITY.WEEKLY_CONTENTS,
  SNAPSHOT_ENTITY.CLO,
  SNAPSHOT_ENTITY.FORMULA,
  SNAPSHOT_ENTITY.COMPONENT,
  SNAPSHOT_ENTITY.CLO_MAPPING,
  AUTHORED_ENTITY.COURSE_FIELD,
  AUTHORED_ENTITY.COURSE_RELATION,
  AUTHORED_ENTITY.ORG_MEMBERSHIP,
  AUTHORED_ENTITY.ORG_DIRECTOR,
];

export const DIFF_SECTION_TITLES: Record<string, string> = {
  [SNAPSHOT_ENTITY.VERSION_INFO]: 'Thông tin chương trình',
  [SNAPSHOT_ENTITY.ELECTIVE_GROUP]: 'Nhóm tự chọn',
  [SNAPSHOT_ENTITY.CURRICULUM_ITEM]: 'Học phần trong khung',
  [SNAPSHOT_ENTITY.CURRICULUM_REQUISITE]: 'Điều kiện học phần trong khung',
  [SNAPSHOT_ENTITY.PLO]: 'Chuẩn đầu ra chương trình (PLO)',
  [SNAPSHOT_ENTITY.COURSE_PLO]: 'Ma trận học phần–PLO',
  [SNAPSHOT_ENTITY.CLO_PLO]: 'Ma trận CLO–PLO',
  [SNAPSHOT_ENTITY.SYLLABUS_FIELD]: 'Nội dung đề cương',
  [SNAPSHOT_ENTITY.WEEKLY_CONTENTS]: 'Nội dung theo tuần',
  [SNAPSHOT_ENTITY.CLO]: 'Chuẩn đầu ra học phần (CLO)',
  [SNAPSHOT_ENTITY.FORMULA]: 'Công thức điểm',
  [SNAPSHOT_ENTITY.COMPONENT]: 'Thành phần đánh giá',
  [SNAPSHOT_ENTITY.CLO_MAPPING]: 'Ánh xạ thành phần–CLO',
  [AUTHORED_ENTITY.COURSE_FIELD]: 'Thông tin học phần',
  [AUTHORED_ENTITY.COURSE_RELATION]: 'Quan hệ học phần',
  [AUTHORED_ENTITY.ORG_MEMBERSHIP]: 'Thành viên nhóm chuyên môn',
  [AUTHORED_ENTITY.ORG_DIRECTOR]: 'Giám đốc CTĐT',
};

export const VERSION_INFO_LABELS: Record<string, string> = {
  programName: 'Tên chương trình',
  majorCode: 'Mã ngành',
  majorName: 'Tên ngành',
  semesterCount: 'Số học kỳ',
  totalCredits: 'Tổng tín chỉ',
  compulsoryCredits: 'Tín chỉ bắt buộc',
  electiveCredits: 'Tín chỉ tự chọn',
  creditMismatchReason: 'Lý do chấp nhận chênh lệch tín chỉ',
};

export const SYLLABUS_SECTION_LABELS: Record<string, string> = {
  courseDescription: 'Mô tả học phần',
  englishDescription: 'Mô tả (tiếng Anh)',
  objectives: 'Mục tiêu',
  teachingMethods: 'Phương pháp giảng dạy',
  assessmentMethods: 'Phương pháp đánh giá',
  references: 'Tài liệu tham khảo',
};

export const COURSE_FIELD_LABELS: Record<string, string> = {
  courseName: 'Tên học phần',
  englishName: 'Tên tiếng Anh',
  credits: 'Số tín chỉ',
  courseType: 'Loại học phần',
  ownerGroupId: 'Nhóm chuyên môn phụ trách',
};

export const RELATION_TYPE_LABELS: Record<string, string> = {
  PRIOR: 'Học trước',
  PREREQUISITE: 'Tiên quyết',
  COREQUISITE: 'Song hành',
  REPLACEMENT: 'Thay thế',
};

export const MEMBER_ROLE_LABELS: Record<string, string> = {
  MEMBER: 'Thành viên',
  COORDINATOR: 'Điều phối',
};

// Field names inside an entry's value map, as printed in the before/after table.
export const DIFF_FIELD_LABELS: Record<string, string> = {
  value: 'Giá trị',
  text: 'Nội dung',
  groupName: 'Tên nhóm',
  minCredits: 'Tín chỉ tối thiểu',
  minCourses: 'Số học phần tối thiểu',
  plannedSemester: 'Học kỳ',
  sortOrder: 'Thứ tự',
  blockSymbol: 'Khối kiến thức',
  isElective: 'Tự chọn',
  electiveGroup: 'Nhóm tự chọn',
  htDa: 'HT/ĐA',
  tqDa: 'TQ/ĐA',
  minStudiedScore: 'Điểm tối thiểu (đã học)',
  minTransferScore: 'Điểm tối thiểu (chuyển đổi)',
  note: 'Ghi chú',
  minScore: 'Ngưỡng điểm',
  description: 'Mô tả',
  englishDescription: 'Mô tả (tiếng Anh)',
  competencyGroup: 'Nhóm năng lực',
  weight: 'Trọng số',
  linked: 'Liên kết',
  cognitiveLevel: 'Mức nhận thức',
  memberRole: 'Vai trò',
  validFrom: 'Từ ngày',
  validTo: 'Đến ngày',
  lecturer: 'Giảng viên',
  director: 'Người được phân công',
  componentName: 'Tên thành phần',
  assessmentForm: 'Hình thức đánh giá',
  isConditional: 'Điều kiện',
  conditionThreshold: 'Ngưỡng điều kiện',
  failingScore: 'Điểm liệt',
  cloWeight: 'Trọng số CLO',
};

// Values that hold rich text: printed as plain text in the diff.
export const RICH_TEXT_FIELDS: ReadonlySet<string> = new Set(['text']);
export const BOOLEAN_FIELDS: ReadonlySet<string> = new Set([
  'isElective',
  'htDa',
  'tqDa',
  'linked',
  'isConditional',
]);
