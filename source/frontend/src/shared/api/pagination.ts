export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export interface PageParams {
  page: number;
  pageSize: number;
}

export function nextPageNumber({
  page,
  pageSize,
  total,
}: PageParams & { total: number }) {
  return page * pageSize < total ? page + 1 : undefined;
}
