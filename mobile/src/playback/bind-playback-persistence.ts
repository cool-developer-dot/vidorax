/**
 * App bootstrap binder — keeps react-native / API client off the Node verify path.
 * Import only from app-initializer / session teardown.
 */

import {
  subscribePlaybackEvents,
  type PlaybackEventListener,
} from '../player/playback-events';
import {
  PlaybackPersistenceCoordinator,
  type PlaybackCoordinatorDeps,
  type PlaybackSyncTransport,
} from './coordinator';
import { invalidatePlaybackUiQueries } from './query-keys';

let coordinator: PlaybackPersistenceCoordinator | null = null;
let unsubEvents: (() => void) | null = null;
let bound = false;

function createDefaultSyncTransport(): PlaybackSyncTransport {
  return {
    updateProgress: async (mediaId, body) => {
      const { updatePlaybackProgress } = await import('../api/playback.api');
      return updatePlaybackProgress(mediaId, body);
    },
  };
}

function resolveUserId(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useUserStore } = require('../store/user') as {
      useUserStore: {
        getState: () => { profile: { id: string | null } };
      };
    };
    return useUserStore.getState().profile.id;
  } catch {
    return null;
  }
}

function defaultSubscribeAppState(
  listener: (status: string) => void,
): () => void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as {
      AppState: {
        addEventListener: (
          type: string,
          cb: (status: string) => void,
        ) => { remove: () => void };
      };
    };
    const sub = rn.AppState.addEventListener('change', listener);
    return () => {
      sub.remove();
    };
  } catch {
    return () => undefined;
  }
}

/**
 * Reuses download NetInfo monitor — one reconnect edge detector.
 * Never installs a second network library.
 */
function defaultSubscribeNetworkReconnect(listener: () => void): () => void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const network = require('../downloads/network/service') as {
      subscribeDownloadNetwork: (
        cb: (state: {
          connected: boolean;
          internetReachable: boolean | null;
        }) => void,
      ) => () => void;
      getDownloadNetworkState: () => {
        connected: boolean;
        internetReachable: boolean | null;
      };
      startDownloadNetworkMonitor: () => Promise<void>;
    };

    void network.startDownloadNetworkMonitor();

    let wasOnline = (() => {
      const s = network.getDownloadNetworkState();
      return s.connected && s.internetReachable !== false;
    })();

    return network.subscribeDownloadNetwork((state) => {
      const online =
        state.connected && state.internetReachable !== false;
      if (online && !wasOnline) {
        listener();
      }
      wasOnline = online;
    });
  } catch {
    return () => undefined;
  }
}

function defaultBoundaryFlush(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { queryClient } = require('../services/query-client') as {
      queryClient: import('@tanstack/react-query').QueryClient;
    };
    invalidatePlaybackUiQueries(queryClient);
  } catch {
    // optional during early bootstrap / Node verify
  }
}

/**
 * Idempotent bootstrap binding — exactly one subscriber to playback events.
 */
export function bindPlaybackPersistence(
  overrides?: Partial<PlaybackCoordinatorDeps> & {
    coordinator?: PlaybackPersistenceCoordinator;
  },
): PlaybackPersistenceCoordinator {
  if (bound && coordinator && !overrides?.coordinator) {
    return coordinator;
  }

  unsubEvents?.();
  coordinator?.dispose();

  coordinator =
    overrides?.coordinator ??
    new PlaybackPersistenceCoordinator({
      getUserId: overrides?.getUserId ?? resolveUserId,
      sync:
        overrides?.sync === undefined
          ? createDefaultSyncTransport()
          : overrides.sync,
      clock: overrides?.clock,
      localPersistIntervalMs: overrides?.localPersistIntervalMs,
      backendSyncIntervalMs: overrides?.backendSyncIntervalMs,
      subscribeAppState:
        overrides?.subscribeAppState ?? defaultSubscribeAppState,
      subscribeNetworkReconnect:
        overrides?.subscribeNetworkReconnect ??
        defaultSubscribeNetworkReconnect,
      onBoundaryFlush:
        overrides?.onBoundaryFlush ??
        ((_reason, _mediaId) => {
          defaultBoundaryFlush();
        }),
    });

  const listener: PlaybackEventListener = (event) => {
    coordinator?.handleEvent(event);
  };
  unsubEvents = subscribePlaybackEvents(listener);
  bound = true;
  return coordinator;
}

export function getPlaybackCoordinator(): PlaybackPersistenceCoordinator | null {
  return coordinator;
}

/** Logout: cancel sync timers / in-memory session (durable local keys retained). */
export function resetPlaybackPersistenceForLogout(): void {
  coordinator?.resetForLogout();
}

export function unbindPlaybackPersistenceForTests(): void {
  unsubEvents?.();
  unsubEvents = null;
  coordinator?.dispose();
  coordinator = null;
  bound = false;
}
