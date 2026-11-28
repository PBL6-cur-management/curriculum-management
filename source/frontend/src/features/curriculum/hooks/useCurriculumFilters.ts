import { useMemo, useState } from 'react';
import type { CurriculumItem } from '../api/curriculum';

export type CurriculumKind = 'all' | 'compulsory' | 'elective';
// 'ALL' = all items; 'COMMON' = items with track === null; otherwise specific trackId.
export type CurriculumTrackFilter = 'ALL' | 'COMMON' | (string & {});

export interface CurriculumFilters {
  search: string;
  semester: number | null;
  // `undefined` = any block; `null` = rows with no symbol.
  blockSymbol: string | null | undefined;
  kind: CurriculumKind;
  trackFilter?: CurriculumTrackFilter;
}

export const EMPTY_CURRICULUM_FILTERS: CurriculumFilters = {
  search: '',
  semester: null,
  blockSymbol: undefined,
  kind: 'all',
  trackFilter: 'ALL',
};

const lower = (text: string) => text.toLocaleLowerCase('vi');

function matchesTrack(
  item: CurriculumItem,
  trackFilter: CurriculumTrackFilter | undefined,
): boolean {
  if (!trackFilter || trackFilter === 'ALL') return true;
  if (trackFilter === 'COMMON') return item.track === null;
  return item.track?.id === trackFilter;
}

// Pure so it is tested without rendering (D16): filtering runs over the whole loaded curriculum, at most 200 rows.
export function applyCurriculumFilters(
  items: readonly CurriculumItem[],
  filters: CurriculumFilters,
): CurriculumItem[] {
  const needle = lower(filters.search.trim());
  return items.filter(
    (item) =>
      (needle === '' ||
        lower(item.course.courseCode).includes(needle) ||
        lower(item.course.courseName).includes(needle)) &&
      (filters.semester === null ||
        item.plannedSemester === filters.semester) &&
      (filters.blockSymbol === undefined ||
        item.blockSymbol === filters.blockSymbol) &&
      (filters.kind === 'all' ||
        item.isElective === (filters.kind === 'elective')) &&
      matchesTrack(item, filters.trackFilter),
  );
}

export function isFiltering(filters: CurriculumFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.semester !== null ||
    filters.blockSymbol !== undefined ||
    filters.kind !== 'all' ||
    (filters.trackFilter !== undefined && filters.trackFilter !== 'ALL')
  );
}

export function useCurriculumFilters(
  items: readonly CurriculumItem[],
  initialTrackFilter?: CurriculumTrackFilter,
) {
  const normalizedInitial: CurriculumTrackFilter =
    initialTrackFilter && initialTrackFilter.trim() !== ''
      ? initialTrackFilter
      : 'ALL';
  const [filters, setFilters] = useState<CurriculumFilters>(() => ({
    ...EMPTY_CURRICULUM_FILTERS,
    trackFilter: normalizedInitial,
  }));
  const [prevInitialTrack, setPrevInitialTrack] =
    useState<CurriculumTrackFilter>(normalizedInitial);

  if (normalizedInitial !== prevInitialTrack) {
    setPrevInitialTrack(normalizedInitial);
    setFilters((current) => ({ ...current, trackFilter: normalizedInitial }));
  }

  const visible = useMemo(
    () => applyCurriculumFilters(items, filters),
    [items, filters],
  );
  return { filters, setFilters, visible, filtered: isFiltering(filters) };
}
