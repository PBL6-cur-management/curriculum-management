import type { Rule } from 'antd/es/form';

// Mirrors ROLE_FIELD_LIMITS and ROLE_CODE_PATTERN in source/backend/src/features/permissions/create-role.dto.ts.
export const ROLE_CODE_MIN = 2;
export const ROLE_CODE_MAX = 32;
export const ROLE_NAME_MIN = 2;
export const ROLE_NAME_MAX = 100;
export const ROLE_DESCRIPTION_MAX = 500;
export const ROLE_CODE_PATTERN = /^[A-Z0-9_]+$/;

export const ROLE_CODE_RULES: Rule[] = [
  { required: true, whitespace: true, message: 'Nhập mã vai trò.' },
  {
    min: ROLE_CODE_MIN,
    max: ROLE_CODE_MAX,
    message: `Mã vai trò từ ${ROLE_CODE_MIN} đến ${ROLE_CODE_MAX} ký tự.`,
  },
  {
    pattern: ROLE_CODE_PATTERN,
    message: 'Mã vai trò chỉ gồm chữ in hoa (A–Z), chữ số hoặc dấu gạch dưới (_).',
  },
];

export const ROLE_NAME_RULES: Rule[] = [
  { required: true, whitespace: true, message: 'Nhập tên vai trò.' },
  {
    min: ROLE_NAME_MIN,
    max: ROLE_NAME_MAX,
    message: `Tên vai trò từ ${ROLE_NAME_MIN} đến ${ROLE_NAME_MAX} ký tự.`,
  },
];

export const ROLE_DESCRIPTION_RULES: Rule[] = [
  {
    max: ROLE_DESCRIPTION_MAX,
    message: `Mô tả tối đa ${ROLE_DESCRIPTION_MAX} ký tự.`,
  },
];
