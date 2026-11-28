import type { Rule } from 'antd/es/form';
import {
  CREDITS_MESSAGE,
  CREDITS_PATTERN,
} from '../../../shared/forms/credits';

// Mirrors CURRICULUM_LIMITS in source/backend/src/features/curriculum/create-curriculum-item.dto.ts
// and TRACK_LIMITS in source/backend/src/features/curriculum/program-track.dto.ts.
export const CURRICULUM_FORM_LIMITS = {
  BLOCK_SYMBOL_MAX: 20,
  NOTE_MAX: 500,
  REQUISITES_MAX: 20,
  GROUP_CODE_MAX: 20,
  GROUP_NAME_MAX: 200,
  TRACK_CODE_MAX: 30,
  TRACK_NAME_MAX: 200,
  TRACK_DESC_MAX: 1000,
} as const;

// DEC-11: Prerequisite / curriculum score thresholds use the 10-point scale (0..10, max 2 decimals).
export const CURRICULUM_SCORE_PATTERN = /^(10(\.0{1,2})?|\d(\.\d{1,2})?)$/;
export const CURRICULUM_SCORE_MESSAGE =
  'Ngưỡng điểm theo thang 10: từ 0 đến 10, tối đa 2 chữ số thập phân (ví dụ 4.0 hoặc 5.5).';

export const CURRICULUM_SCORE_RULES: Rule[] = [
  { pattern: CURRICULUM_SCORE_PATTERN, message: CURRICULUM_SCORE_MESSAGE },
];

export const TRACK_CODE_RULES: Rule[] = [
  {
    required: true,
    whitespace: true,
    message: 'Nhập mã định hướng (ví dụ: CNPM).',
  },
  {
    max: CURRICULUM_FORM_LIMITS.TRACK_CODE_MAX,
    message: `Mã định hướng tối đa ${CURRICULUM_FORM_LIMITS.TRACK_CODE_MAX} ký tự.`,
  },
];

export const TRACK_NAME_RULES: Rule[] = [
  {
    required: true,
    whitespace: true,
    message: 'Nhập tên định hướng / chuyên ngành con.',
  },
  {
    max: CURRICULUM_FORM_LIMITS.TRACK_NAME_MAX,
    message: `Tên định hướng tối đa ${CURRICULUM_FORM_LIMITS.TRACK_NAME_MAX} ký tự.`,
  },
];

export const TRACK_ENGLISH_NAME_RULES: Rule[] = [
  {
    max: CURRICULUM_FORM_LIMITS.TRACK_NAME_MAX,
    message: `Tên tiếng Anh tối đa ${CURRICULUM_FORM_LIMITS.TRACK_NAME_MAX} ký tự.`,
  },
];

export const TRACK_DESC_RULES: Rule[] = [
  {
    max: CURRICULUM_FORM_LIMITS.TRACK_DESC_MAX,
    message: `Mô tả tối đa ${CURRICULUM_FORM_LIMITS.TRACK_DESC_MAX} ký tự.`,
  },
];

export const TRACK_CREDITS_RULES: Rule[] = [
  { pattern: CREDITS_PATTERN, message: CREDITS_MESSAGE },
];
