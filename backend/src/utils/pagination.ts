export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_RECENT_URLS_LIMIT = 20;

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export type ListSort = 'newest' | 'oldest' | 'alphabetical';

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    offset: number;
    hasMore: boolean;
  };
}

export const parsePagination = (
  query: Record<string, unknown>,
): PaginationParams => {
  const rawLimit = Number(query.limit ?? DEFAULT_PAGE_LIMIT);

  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_PAGE_LIMIT)
    : DEFAULT_PAGE_LIMIT;

  if (query.page !== undefined) {
    const rawPage = Number(query.page);
    const page = Number.isFinite(rawPage)
      ? Math.max(Math.trunc(rawPage), 1)
      : 1;

    return {
      page,
      limit,
      offset: Math.min((page - 1) * limit, Number.MAX_SAFE_INTEGER),
    };
  }

  const rawOffset = Number(query.offset ?? 0);
  const offset = Number.isFinite(rawOffset)
    ? Math.max(Math.trunc(rawOffset), 0)
    : 0;

  return {
    page: Math.floor(offset / limit) + 1,
    limit,
    offset,
  };
};

export const buildPaginatedResult = <T>(
  items: T[],
  total: number,
  pagination: PaginationParams,
): PaginatedResult<T> => ({
  items,
  pagination: {
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
    offset: pagination.offset,
    hasMore: pagination.offset + items.length < total,
  },
});

export const buildSortOrder = (
  sort: ListSort = 'newest',
  chronologicalField = 'createdAt',
  alphabeticalField = 'title',
): Record<string, 'asc' | 'desc'> => {
  if (sort === 'alphabetical') {
    return { [alphabeticalField]: 'asc' };
  }

  return { [chronologicalField]: sort === 'oldest' ? 'asc' : 'desc' };
};
