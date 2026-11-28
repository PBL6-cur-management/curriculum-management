import type { Rule } from 'antd/es/form';

export const MAJOR_CODE_MAX = 20;
export const MAJOR_NAME_MAX = 200;

export const MAJOR_CODE_RULES: Rule[] = [
  { required: true, whitespace: true, message: 'Nhập mã ngành (vd: 7480201).' },
  {
    max: MAJOR_CODE_MAX,
    message: `Mã ngành tối đa ${MAJOR_CODE_MAX} ký tự.`,
  },
];

export const MAJOR_NAME_RULES: Rule[] = [
  { required: true, whitespace: true, message: 'Nhập tên ngành.' },
  {
    max: MAJOR_NAME_MAX,
    message: `Tên ngành tối đa ${MAJOR_NAME_MAX} ký tự.`,
  },
];
