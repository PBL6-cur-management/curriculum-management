import { getJson, withQuery } from '../api/client';
import type { components } from '../api/schema';
import { COURSE_QUERY_ROOT } from './courseQueryKeys';

export type CourseOption = components['schemas']['CourseSummaryDto'];
type CoursePage = components['schemas']['CoursePageDto'];
type CourseStatus = components['schemas']['CourseStatus'];

// Its own path and fetcher: shared code must not import from a feature (react-vite-rules §4).
export const COURSE_SEARCH_PATH = '/courses';
export const COURSE_SEARCH_PAGE_SIZE = 20;
// Active courses only unless a caller asks for more: most dialogs accept no discontinued or cancelled course as the other end,
// while the curriculum's requisites keep old prerequisites valid (US-023 AC4).
export const DEFAULT_SEARCH_STATUSES: readonly CourseStatus[] = ['ACTIVE'];
export const courseSearchQueryKey = (
  q: string,
  statuses: readonly CourseStatus[] = DEFAULT_SEARCH_STATUSES,
) => [...COURSE_QUERY_ROOT, 'search', q, statuses] as const;

export const searchCourses = (
  q: string,
  statuses: readonly CourseStatus[] = DEFAULT_SEARCH_STATUSES,
  page = 1,
) =>
  getJson<CoursePage>(
    withQuery(COURSE_SEARCH_PATH, {
      q,
      page: page === 1 ? undefined : page,
      pageSize: COURSE_SEARCH_PAGE_SIZE,
      status: statuses,
    }),
  );

export const courseOptionLabel = (course: CourseOption) =>
  `${course.courseCode} — ${course.courseName} (${course.credits} TC)`;
