import type { CourseRelationType } from '../api/courseRelations';

// One choice per reading of a relation from the current course's side; `currentIs` says where the current course sits.
// A relation is stored once (source = studied first, or discontinued; target = holds the requirement),
// so the label depends on type and side together, never on the type alone.
export const RELATION_CHOICES = [
  {
    key: 'needsPrior',
    type: 'PRIOR',
    currentIs: 'target',
    label: 'Cần học trước học phần',
  },
  {
    key: 'isPriorOf',
    type: 'PRIOR',
    currentIs: 'source',
    label: 'Là học phần học trước của',
  },
  {
    key: 'needsPrerequisite',
    type: 'PREREQUISITE',
    currentIs: 'target',
    label: 'Cần đạt tiên quyết học phần',
  },
  {
    key: 'isPrerequisiteOf',
    type: 'PREREQUISITE',
    currentIs: 'source',
    label: 'Là học phần tiên quyết của',
  },
  {
    key: 'corequisiteWith',
    type: 'COREQUISITE',
    currentIs: 'target',
    label: 'Học song hành với',
  },
  {
    key: 'replacedBy',
    type: 'REPLACEMENT',
    currentIs: 'source',
    label: 'Được thay thế bởi',
  },
  {
    key: 'replaces',
    type: 'REPLACEMENT',
    currentIs: 'target',
    label: 'Thay thế cho',
  },
] as const satisfies readonly {
  key: string;
  type: CourseRelationType;
  currentIs: 'source' | 'target';
  label: string;
}[];

export type RelationChoice = (typeof RELATION_CHOICES)[number];
export type RelationChoiceKey = RelationChoice['key'];
export type RelationSide = RelationChoice['currentIs'];

export const RELATION_TYPE_LABELS: Record<CourseRelationType, string> = {
  PRIOR: 'Học trước',
  PREREQUISITE: 'Tiên quyết',
  COREQUISITE: 'Song hành',
  REPLACEMENT: 'Thay thế',
};

export const MIN_SCORE_HINT =
  'Thang 10 (0–10), để trống nếu không yêu cầu điểm.';
export const NO_EQUIVALENT_GROUP_TEXT = 'Chưa thuộc nhóm tương đương nào';

// A corequisite reads the same from both ends.
export function relationLabel(
  type: CourseRelationType,
  side: RelationSide,
): string {
  const choice =
    RELATION_CHOICES.find(
      (item) => item.type === type && item.currentIs === side,
    ) ?? RELATION_CHOICES.find((item) => item.type === type);
  return choice?.label ?? RELATION_TYPE_LABELS[type];
}
