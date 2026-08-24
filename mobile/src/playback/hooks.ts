import {
  useInfiniteQuery,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { classifyRemoteFailure } from '@/api/errors';
import {
  getPlayback,
  listContinueWatching,
  listPlaybackHistory,
  listRecentPlayback,
} from '@/api/playback.api';
import { useUserStore } from '@/store/user';
import { selectAppOnline, useAppStore } from '@/store/app';

import { PLAYBACK_HISTORY_PAGE_SIZE } from './constants';
import {
  isContinueWatchingEligible,
  sortByLastPlayedDesc,
} from './domain/continue-watching';
import {
  localStateToSummary,
  mergePlaybackStates,
  mergePlaybackSummariesByMediaId,
  remoteDtoToSummary,
  type PlaybackSummary,
} from './domain/merge';
import { listPlaybackStatesForUser, loadPlaybackState } from './persistence';
import { playbackQueryKeys } from './query-keys';

function useAuthUserId(): string | null {
  return useUserStore((s) => s.profile.id);
}

/** Local playback summaries for the current user. */
export function listLocalPlaybackSummaries(userId: string): PlaybackSummary[] {
  if (!userId) {
    return [];
  }
  return listPlaybackStatesForUser(userId).map(localStateToSummary);
}

export function resolvePlaybackSummary(
  userId: string | null,
  mediaId: string,
  remote: PlaybackSummary | null,
): PlaybackSummary | null {
  if (!userId || !mediaId) {
    return remote;
  }
  const local = loadPlaybackState(userId, mediaId);
  return mergePlaybackStates(local, remote);
}

export function usePlaybackDetail(mediaId: string | null) {
  const userId = useAuthUserId();
  const online = useAppStore(selectAppOnline);

  const remoteQuery = useQuery({
    queryKey: playbackQueryKeys.detail(userId ?? 'anon', mediaId ?? ''),
    queryFn: async () => {
      if (!mediaId) {
        return null;
      }
      try {
        return remoteDtoToSummary(await getPlayback(mediaId));
      } catch {
        return null;
      }
    },
    enabled: Boolean(userId && mediaId && online),
    staleTime: 30_000,
    retry: 0,
  });

  const merged = useMemo(() => {
    if (!userId || !mediaId) {
      return null;
    }
    const local = loadPlaybackState(userId, mediaId);
    return mergePlaybackStates(local, remoteQuery.data ?? null);
  }, [userId, mediaId, remoteQuery.data, remoteQuery.dataUpdatedAt]);

  return {
    summary: merged,
    isLoading: remoteQuery.isLoading && !merged,
    isError: remoteQuery.isError && !merged,
    refetch: remoteQuery.refetch,
  };
}

export function useContinueWatchingQuery() {
  const userId = useAuthUserId();
  const online = useAppStore(selectAppOnline);

  const remoteQuery = useQuery({
    queryKey: playbackQueryKeys.continueWatching(userId ?? 'anon'),
    queryFn: async () => {
      const page = await listContinueWatching({
        page: 1,
        limit: PLAYBACK_HISTORY_PAGE_SIZE,
      });
      return page.items.map(remoteDtoToSummary);
    },
    enabled: Boolean(userId && online),
    staleTime: 30_000,
    retry: (count, error) =>
      classifyRemoteFailure(error) === 'transient' && count < 1,
  });

  const items = useMemo(() => {
    if (!userId) {
      return [] as PlaybackSummary[];
    }
    const local = listLocalPlaybackSummaries(userId);
    const merged = mergePlaybackSummariesByMediaId([
      remoteQuery.data ?? [],
      local,
    ]);
    return sortByLastPlayedDesc(
      merged.filter((s) => isContinueWatchingEligible(s)),
    );
  }, [userId, remoteQuery.data, remoteQuery.dataUpdatedAt]);

  return {
    items,
    isLoading: remoteQuery.isLoading && items.length === 0,
    isError: remoteQuery.isError,
    refetch: remoteQuery.refetch,
    isOfflineFallback: !online || remoteQuery.isError,
  };
}

export function useRecentPlaybackQuery(limit = 20) {
  const userId = useAuthUserId();
  const online = useAppStore(selectAppOnline);

  const remoteQuery = useQuery({
    queryKey: playbackQueryKeys.recent(userId ?? 'anon'),
    queryFn: async () => {
      const page = await listRecentPlayback({ limit });
      return page.items.map(remoteDtoToSummary);
    },
    enabled: Boolean(userId && online),
    staleTime: 30_000,
    retry: (count, error) =>
      classifyRemoteFailure(error) === 'transient' && count < 1,
  });

  const items = useMemo(() => {
    if (!userId) {
      return [] as PlaybackSummary[];
    }
    const local = listLocalPlaybackSummaries(userId).filter(
      (s) => s.lastPlayedAt != null,
    );
    const merged = mergePlaybackSummariesByMediaId([
      remoteQuery.data ?? [],
      local,
    ]).filter((s) => s.lastPlayedAt != null);
    return sortByLastPlayedDesc(merged);
  }, [userId, remoteQuery.data, remoteQuery.dataUpdatedAt]);

  return {
    items,
    isLoading: remoteQuery.isLoading && items.length === 0,
    refetch: remoteQuery.refetch,
  };
}

export function usePlaybackHistoryInfiniteQuery() {
  const userId = useAuthUserId();
  const online = useAppStore(selectAppOnline);

  const query = useInfiniteQuery({
    queryKey: playbackQueryKeys.history(userId ?? 'anon'),
    queryFn: async ({ pageParam }) => {
      const page = await listPlaybackHistory({
        page: pageParam,
        limit: PLAYBACK_HISTORY_PAGE_SIZE,
      });
      return page;
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.hasMore ? last.pagination.page + 1 : undefined,
    enabled: Boolean(userId && online),
    staleTime: 30_000,
    retry: (count, error) =>
      classifyRemoteFailure(error) === 'transient' && count < 1,
  });

  const remoteItems = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return pages.flatMap((p) => p.items.map(remoteDtoToSummary));
  }, [query.data]);

  const items = useMemo(() => {
    if (!userId) {
      return [] as PlaybackSummary[];
    }
    const local = listLocalPlaybackSummaries(userId).filter(
      (s) => s.lastPlayedAt != null,
    );
    if (!online || query.isError) {
      return sortByLastPlayedDesc(local);
    }
    return sortByLastPlayedDesc(
      mergePlaybackSummariesByMediaId([remoteItems, local]),
    );
  }, [userId, remoteItems, online, query.isError, query.dataUpdatedAt]);

  return {
    items,
    isLoading: query.isLoading && items.length === 0,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError && items.length === 0,
    refetch: query.refetch,
    isOfflineFallback: !online || (query.isError && items.length > 0),
  };
}

export function buildPlaybackSummaryMap(
  summaries: readonly PlaybackSummary[],
): Map<string, PlaybackSummary> {
  const map = new Map<string, PlaybackSummary>();
  for (const s of summaries) {
    map.set(s.mediaId, s);
  }
  return map;
}

export type { QueryClient };
