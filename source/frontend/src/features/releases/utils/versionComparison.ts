import { generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import type { VersionRef } from '../api/releases';

export const VERSION_COMPARISON_SELECTION_SIZE = 2;
export const EMPTY_COMPARISON_VALUE = '—';
export function isIssuedVersion(version: VersionRef): boolean {
  return (
    version.status !== 'DRAFT' &&
    Boolean(
      version.versionNumber && version.publishedAt && version.effectiveSemester,
    )
  );
}
export function comparisonPath(
  programId: string,
  beforeVersionId: string,
  afterVersionId: string,
  courseId?: string,
): string {
  const route = courseId
    ? generatePath(ROUTES.pinnedSyllabusCompare, { programId, courseId })
    : generatePath(ROUTES.versionCompare, { programId });
  return `${route}?${new URLSearchParams({ beforeVersionId, afterVersionId })}`;
}
