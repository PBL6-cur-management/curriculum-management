import { toDiffRow } from '../../shared/change-requests/diff/diff-presenter.js';
import { diffSnapshots } from '../../shared/change-requests/diff/snapshot-differ.js';
import {
  VERSION_COMPARE_SECTIONS,
  type VersionComparisonDto,
  type VersionCompareSectionDto,
} from './dto/version-comparison.dto.js';
import type { ReleasedProgramSnapshot } from './released-version-snapshot.reader.js';
import {
  VERSION_COMPARE_ENTITIES,
  VERSION_COMPARE_ENTITY_ORDER,
  VERSION_COMPARE_FIELDS,
  VERSION_COMPARE_TITLES,
} from './version-comparison.constants.js';

export function presentVersionComparison(
  programId: string,
  before: ReleasedProgramSnapshot,
  after: ReleasedProgramSnapshot,
): VersionComparisonDto {
  const sections: VersionCompareSectionDto[] = Object.values(
    VERSION_COMPARE_SECTIONS,
  ).map((key) => ({ key, title: VERSION_COMPARE_TITLES[key], rows: [] }));
  const changes = diffSnapshots(
    before.entries,
    after.entries,
    before.version.id,
  ).sort(
    (left, right) =>
      VERSION_COMPARE_ENTITY_ORDER.indexOf(left.entityType) -
        VERSION_COMPARE_ENTITY_ORDER.indexOf(right.entityType) ||
      left.itemKey.localeCompare(right.itemKey, 'vi'),
  );
  for (const change of changes) {
    const row = toDiffRow(change);
    row.fields = row.fields.map((field) => ({
      ...field,
      label: VERSION_COMPARE_FIELDS[field.name] ?? field.label,
    }));
    const oldPin = before.pinsByCourseCode.get(change.itemKey);
    const newPin = after.pinsByCourseCode.get(change.itemKey);
    const syllabusComparison =
      change.entityType === 'PINNED_SYLLABUS' &&
      oldPin &&
      newPin &&
      oldPin.syllabusId !== newPin.syllabusId
        ? {
            courseId: newPin.courseId,
            beforeSyllabusId: oldPin.syllabusId,
            afterSyllabusId: newPin.syllabusId,
          }
        : null;
    sections
      .find(
        (section) =>
          section.key === VERSION_COMPARE_ENTITIES[change.entityType],
      )!
      .rows.push({ ...row, syllabusComparison });
  }
  return { programId, before: before.version, after: after.version, sections };
}
