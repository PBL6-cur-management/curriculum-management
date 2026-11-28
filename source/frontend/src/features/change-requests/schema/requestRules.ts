import type { Rule } from 'antd/es/form';
import type {
  ChangeRequestType,
  ChangeTargetType,
  RequestOrigin,
} from '../api/changeRequests';
import {
  BASIS_NUMBER_MAX,
  REASON_MAX,
  TITLE_MAX,
} from '../constants/changeRequestLimits';

export interface RequestHeaderValues {
  requestType: ChangeRequestType;
  targetType: ChangeTargetType;
  targetId: string;
  title: string;
  reason: string;
  origin: RequestOrigin;
  basisDocumentNumber?: string;
  effectiveSemesterId?: string | null;
  cohortIds?: string[];
}

export const titleRules: Rule[] = [
  { required: true, whitespace: true, message: 'Nhập tiêu đề đề xuất.' },
  { max: TITLE_MAX, message: `Tối đa ${TITLE_MAX} ký tự.` },
];
export const reasonRules: Rule[] = [
  { required: true, whitespace: true, message: 'Nhập lý do đề xuất.' },
  { max: REASON_MAX, message: `Tối đa ${REASON_MAX} ký tự.` },
];

// US-055 AC1–AC2: the basis number is required for the "Trường" origin only; the form watches the origin.
export const basisNumberRules = (origin: RequestOrigin | undefined): Rule[] => [
  {
    required: origin === 'UNIVERSITY',
    whitespace: true,
    message: 'Nhập số văn bản căn cứ của Trường.',
  },
  { max: BASIS_NUMBER_MAX, message: `Tối đa ${BASIS_NUMBER_MAX} ký tự.` },
];

// A server refusal that names no field in `details` still belongs under one of the form's fields.
export const FIELD_BY_CODE: Record<string, keyof RequestHeaderValues> = {
  TARGET_NOT_RELEASED: 'targetId',
  TYPE_TARGET_MISMATCH: 'targetId',
  TARGET_NOT_FOUND: 'targetId',
  BASIS_REQUIRED: 'basisDocumentNumber',
};
