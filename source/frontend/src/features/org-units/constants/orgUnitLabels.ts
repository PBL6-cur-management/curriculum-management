import type { OrgUnit } from '../../../shared/org-units/orgUnits';
export const UNIT_TYPE_LABELS: Record<OrgUnit['unitType'], string> = {
  UNIVERSITY: 'Trường',
  FACULTY: 'Khoa',
  OFFICE: 'Phòng',
};
export const UNIT_STATUS_LABELS: Record<OrgUnit['status'], string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};
export const EXTERNAL_UNIT_TAG_LABEL = 'Đơn vị ngoài trường';
export const EXTERNAL_UNIT_CHECKBOX_LABEL =
  'Đơn vị ngoài trường (ví dụ: Trung tâm GDQP&AN ĐHĐN)';
export type OrgUnitScopeFilter = 'ALL' | 'INTERNAL' | 'EXTERNAL';
export const ORG_UNIT_SCOPE_OPTIONS: {
  value: OrgUnitScopeFilter;
  label: string;
}[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'INTERNAL', label: 'Nội bộ' },
  { value: 'EXTERNAL', label: 'Ngoài trường' },
];
export const CREATABLE_UNIT_TYPES = [
  'FACULTY',
  'OFFICE',
] as const satisfies readonly OrgUnit['unitType'][];
export const ALLOWED_PARENT_TYPES: Record<
  OrgUnit['unitType'],
  readonly OrgUnit['unitType'][]
> = { UNIVERSITY: [], FACULTY: ['UNIVERSITY'], OFFICE: ['UNIVERSITY'] };
