import type { Rule } from 'antd/es/form';
import { STUDENT_BASIS_MAX_LENGTH } from '../constants/studentLabels';

export const enrollmentBasisRules: Rule[] = [
  {
    required: true,
    whitespace: true,
    message: 'Nhập căn cứ hoặc số quyết định.',
  },
  {
    max: STUDENT_BASIS_MAX_LENGTH,
    message: `Căn cứ không quá ${STUDENT_BASIS_MAX_LENGTH} ký tự.`,
  },
];
