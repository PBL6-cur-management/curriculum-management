import type { Rule } from 'antd/es/form';
import { STUDENT_BASIS_MAX_LENGTH } from '../constants/studentLabels';

export const DECISION_NUMBER_MAX_LENGTH = 200;

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

export const BULK_TRANSFER_DECISION_RULES: Rule[] = [
  {
    max: DECISION_NUMBER_MAX_LENGTH,
    message: `Số quyết định không quá ${DECISION_NUMBER_MAX_LENGTH} ký tự.`,
  },
];

export const BULK_TRANSFER_REASON_RULES: Rule[] = [
  {
    max: STUDENT_BASIS_MAX_LENGTH - DECISION_NUMBER_MAX_LENGTH - 3,
    message: 'Lý do chuyển quá dài.',
  },
];
