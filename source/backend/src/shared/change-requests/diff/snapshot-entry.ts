import { Prisma } from '../../../generated/prisma/client.js';
import type { AuthoredPayload } from '../authored-item.types.js';

export type DiffScalar = string | null;

// One thing a reader recognises, keyed by its natural key (never a row id, which differs between a base and its copy).
export interface SnapshotEntry {
  entityType: string;
  itemKey: string;
  label: string;
  recordId: string | null;
  value: Record<string, DiffScalar>;
}

export type ItemValue = Record<string, DiffScalar> | AuthoredPayload;

// A change before it is stored as a ChangeItem row.
export interface ChangeItemDraft {
  sortOrder: number;
  entityType: string;
  itemKey: string;
  label: string;
  recordId: string | null;
  oldValue: ItemValue | null;
  newValue: ItemValue | null;
  baseVersion: string | null;
}

// Prisma wants JsonNull, not null, to write a nullable Json column.
export function toJsonInput(
  value: ItemValue | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export const SNAPSHOT_ENTITY = {
  VERSION_INFO: 'VERSION_INFO',
  ELECTIVE_GROUP: 'ELECTIVE_GROUP',
  CURRICULUM_ITEM: 'CURRICULUM_ITEM',
  CURRICULUM_REQUISITE: 'CURRICULUM_REQUISITE',
  PLO: 'PLO',
  COURSE_PLO: 'COURSE_PLO',
  CLO_PLO: 'CLO_PLO',
  SYLLABUS_FIELD: 'SYLLABUS_FIELD',
  WEEKLY_CONTENTS: 'WEEKLY_CONTENTS',
  CLO: 'CLO',
  FORMULA: 'FORMULA',
  COMPONENT: 'COMPONENT',
  CLO_MAPPING: 'CLO_MAPPING',
} as const;
