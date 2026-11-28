import type {
  MajorOverviewCourse,
  MajorOverviewProgram,
  MajorStatus,
} from '../api/majors';

export const DEGREE_GROUP_LABELS: Record<string, string> = {
  CD01: 'Đại học (7xxxxxx)',
  CD02: 'Thạc sĩ (8xxxxxx)',
  CD03: 'Tiến sĩ (9xxxxxx)',
};

export const DEGREE_GROUP_SHORT_LABELS: Record<string, string> = {
  CD01: 'Đại học',
  CD02: 'Thạc sĩ',
  CD03: 'Tiến sĩ',
};

export const DEGREE_GROUP_OPTIONS = Object.entries(DEGREE_GROUP_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const MAJOR_STATUS_LABELS: Record<MajorStatus, string> = {
  ACTIVE: 'Đang sử dụng',
  INACTIVE: 'Ngừng sử dụng',
};

export const MAJOR_STATUS_COLORS: Record<MajorStatus, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
};

export const MAJOR_PROGRAM_DEGREE_LABELS: Record<
  MajorOverviewProgram['degreeLevel'],
  string
> = {
  BACHELOR: 'Cử nhân',
  ENGINEER: 'Kỹ sư',
  MASTER: 'Thạc sĩ',
  DOCTORATE: 'Tiến sĩ',
};

export const MAJOR_COURSE_TYPE_LABELS: Record<
  MajorOverviewCourse['courseType'],
  string
> = {
  THEORY: 'Lý thuyết',
  PRACTICE: 'Thực hành',
  LAB: 'Thí nghiệm',
  PROJECT: 'Đồ án',
  CAPSTONE: 'Đồ án / Khóa luận TN',
  INTERNSHIP: 'Thực tập',
  CONDITIONAL: 'Điều kiện',
};

export const SUBJECT_GROUP_STATUS_LABELS: Record<
  'ACTIVE' | 'INACTIVE',
  string
> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};

export const SUBJECT_GROUP_STATUS_COLORS: Record<
  'ACTIVE' | 'INACTIVE',
  string
> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
};

export const FACULTY_UNIT_TYPES = ['FACULTY'] as const;
