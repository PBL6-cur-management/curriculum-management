import type { Rule } from 'antd/es/form';
import {
  CREDITS_MESSAGE,
  CREDITS_PATTERN,
} from '../../../shared/forms/credits';

// Re-exported so the course form tests keep one import path for the shared credit rule.
export { CREDITS_MESSAGE, CREDITS_PATTERN };
// Mirrors SCORE10_PATTERN in source/backend/src/shared/decimal/decimal.ts (DEC-11: course relation thresholds use 0..10 scale).
export const SCORE10_PATTERN = /^(10(\.0{1,2})?|\d(\.\d{1,2})?)$/;
export const SCORE10_MESSAGE =
  'Ngưỡng điểm theo thang 10: từ 0 đến 10, tối đa 2 chữ số thập phân (ví dụ 4 hoặc 5.5).';
export const GRADE_POINT_PATTERN = SCORE10_PATTERN;
export const GRADE_POINT_MESSAGE = SCORE10_MESSAGE;
// Mirrors COURSE_FIELD_LIMITS in source/backend/src/features/courses/create-course.dto.ts.
export const COURSE_CODE_MAX = 20;
export const COURSE_NAME_MAX = 200;

export const COURSE_RULES = {
  courseCode: [
    { required: true, whitespace: true, message: 'Nhập mã học phần.' },
    {
      max: COURSE_CODE_MAX,
      message: `Mã học phần tối đa ${COURSE_CODE_MAX} ký tự.`,
    },
  ],
  courseName: [
    {
      required: true,
      whitespace: true,
      message: 'Nhập tên tiếng Việt của học phần.',
    },
    {
      max: COURSE_NAME_MAX,
      message: `Tên học phần tối đa ${COURSE_NAME_MAX} ký tự.`,
    },
  ],
  englishName: [
    {
      max: COURSE_NAME_MAX,
      message: `Tên tiếng Anh tối đa ${COURSE_NAME_MAX} ký tự.`,
    },
  ],
  credits: [
    { required: true, message: 'Nhập số tín chỉ.' },
    { pattern: CREDITS_PATTERN, message: CREDITS_MESSAGE },
  ],
  courseType: [{ required: true, message: 'Chọn loại học phần.' }],
  ownerFacultyId: [{ required: true, message: 'Chọn khoa phụ trách.' }],
} satisfies Record<string, Rule[]>;
