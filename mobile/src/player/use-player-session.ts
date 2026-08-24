/**
 * Screen-local player session: resolve → load → control → cleanup.
 * High-frequency progress stays here — never global Zustand.
 * Stage 3: AppState pause policy, prep timeout, retry, diagnostics.
 */

import { useEventListener } from 'expo';
import { useVideoPlayer } from 'expo-video';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { invalidateLibraryAvailability, reconcileAvailability } from '@/library';
import { decideAppLifecycleAction } from './app-lifecycle-policy';
import { playerLog } from './diagnostics';
import {
  classifyNativePlayerError,
  normalizePlayerError,
  PlaybackError,
  userMessageForPlayerError,
} from './errors';
import { emitPlaybackEvent } from './playback-events';
import {
  adaptVideoPlayer,
  createPlayerController,
} from './player-controller';
import {
  DEFAULT_PLAYBACK_RATE,
  normalizePlaybackRate,
} from './playback-rates';
import { PreparationWatchdog } from './preparation-watchdog';
import { resolvePlaybackSource } from './resolve-playback-source';
import { isCurrentPlayerSession } from './session-generation';
import { ensurePlaybackSourceRuntime } from './resolve-playback-source.runtime';
import {
  PROGRESS_INTERVAL_SECONDS,
  SEEK_STEP_SECONDS,
  initialPlayerSessionState,
  type PlayerController,
  type PlayerErrorCode,
  type PlayerSessionState,
  type PlaybackSource,
} from './types';
import {
  applyMute,
  applyUnmute,
  applyVolumeChange,
  createInitialVolumeState,
} from './volume-state';

export type UsePlayerSessionResult = {
  session: PlayerSessionState;
  controller: PlayerController;
  /** Native player instance for VideoView only — not for control calls. */
  player: ReturnType<typeof useVideoPlayer>;
  /** Bumps on each resolve/load cycle — guards stale resume seeks. */
  resolveGeneration: number;
  seekPreviewSeconds: number | null;
  beginSeekPreview: (seconds: number) => void;
  updateSeekPreview: (seconds: number) => void;
  commitSeekPreview: () => void;
  cancelSeekPreview: () => void;
  setPlaybackRate: (rate: number) => boolean;
  setVolume: (volume: number) => boolean;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  replay: () => void;
  /** Explicit user retry for recoverable errors. */
  retry: () => void;
};

export function usePlayerSession(
  mediaId: string | null,
): UsePlayerSessionResult {
  ensurePlaybackSourceRuntime();
  const [session, setSession] = useState<PlayerSessionState>(() => ({
    ...initialPlayerSessionState,
    mediaId,
    isLoading: true,
    phase: 'resolving',
  }));
  const [seekPreviewSeconds, setSeekPreviewSeconds] = useState<number | null>(
    null,
  );
  /** Bumped by explicit retry without changing mediaId. */
  const [loadNonce, setLoadNonce] = useState(0);
  const [resolveGeneration, setResolveGeneration] = useState(0);

  const sourceRef = useRef<PlaybackSource | null>(null);
  const completionEmittedRef = useRef(false);
  const startedEmittedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const mountedRef = useRef(true);
  const seekingRef = useRef(false);
  const seekPreviewRef = useRef<number | null>(null);
  const resolveGenRef = useRef(0);
  const lastPositionEmitRef = useRef(0);
  const volumeRef = useRef(createInitialVolumeState(1));
  const sessionRef = useRef(session);
  const watchdogRef = useRef<PreparationWatchdog | null>(null);
  const loadArmedRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = PROGRESS_INTERVAL_SECONDS;
    instance.playbackRate = DEFAULT_PLAYBACK_RATE;
    instance.volume = 1;
    instance.muted = false;
  });

  const controller = useMemo(
    () =>
      createPlayerController(adaptVideoPlayer(player), {
        externalLifecycle: true,
      }),
    [player],
  );

  const safeSetSession = useCallback(
    (updater: (prev: PlayerSessionState) => PlayerSessionState) => {
      if (!mountedRef.current) {
        return;
      }
      setSession(updater);
    },
    [],
  );

  const applyTerminalError = useCallback(
    (code: PlayerErrorCode) => {
      try {
        player.pause();
      } catch {
        // ignore
      }
      const id = sourceRef.current?.mediaId ?? mediaId;
      playerLog('player.error', { code, mediaId: id ?? undefined }, 'warn');
      if (code === 'FILE_UNAVAILABLE' && id) {
        // Availability only — never flip download status to FAILED.
        invalidateLibraryAvailability(id);
        void reconcileAvailability([id]).catch(() => undefined);
      }
      safeSetSession((prev) => ({
        ...prev,
        phase: 'error',
        isLoading: false,
        isReady: false,
        isPlaying: false,
        isSeeking: false,
        error: code,
        errorMessage: userMessageForPlayerError(code),
      }));
    },
    [mediaId, player, safeSetSession],
  );

  // Resolve + load when mediaId / retry nonce changes.
  useEffect(() => {
    mountedRef.current = true;
    const gen = ++resolveGenRef.current;
    setResolveGeneration(gen);
    completionEmittedRef.current = false;
    startedEmittedRef.current = false;
    wasPlayingRef.current = false;
    sourceRef.current = null;
    seekPreviewRef.current = null;
    setSeekPreviewSeconds(null);
    seekingRef.current = false;
    volumeRef.current = createInitialVolumeState(1);

    loadArmedRef.current = false;
    lastPositionEmitRef.current = 0;
    watchdogRef.current?.dispose();
    watchdogRef.current = new PreparationWatchdog({
      onTimeout: () => {
        if (gen !== resolveGenRef.current || !mountedRef.current) {
          return;
        }
        applyTerminalError('PREPARATION_TIMEOUT');
      },
    });

    if (!mediaId) {
      applyTerminalError('MEDIA_NOT_FOUND');
      return () => {
        watchdogRef.current?.dispose();
      };
    }

    playerLog('player.resolve_started', { mediaId });
    safeSetSession(() => ({
      ...initialPlayerSessionState,
      mediaId,
      isLoading: true,
      phase: 'resolving',
      playbackRate: DEFAULT_PLAYBACK_RATE,
      volume: 1,
      isMuted: false,
      isCompleted: false,
    }));
    watchdogRef.current.start();

    let cancelled = false;

    (async () => {
      try {
        const source = await resolvePlaybackSource(mediaId);
        if (cancelled || gen !== resolveGenRef.current || !mountedRef.current) {
          return;
        }
        sourceRef.current = source;
        safeSetSession((prev) => ({
          ...prev,
          mediaId: source.mediaId,
          displayName: source.displayName,
          phase: 'preparing',
          isLoading: true,
          error: null,
          errorMessage: null,
          playbackRate: DEFAULT_PLAYBACK_RATE,
          volume: volumeRef.current.volume,
          isMuted: volumeRef.current.isMuted,
          isCompleted: false,
          positionSeconds: 0,
          durationSeconds: null,
        }));

        await player.replaceAsync({
          uri: source.uri,
          contentType: 'auto',
        });
        try {
          player.playbackRate = DEFAULT_PLAYBACK_RATE;
          player.volume = volumeRef.current.volume;
          player.muted = volumeRef.current.isMuted;
        } catch {
          // ignore
        }

        if (cancelled || gen !== resolveGenRef.current || !mountedRef.current) {
          return;
        }
        loadArmedRef.current = true;
        try {
          if (player.status === 'readyToPlay') {
            watchdogRef.current?.clear();
            const duration =
              Number.isFinite(player.duration) && player.duration > 0
                ? player.duration
                : null;
            safeSetSession((prev) => ({
              ...prev,
              isReady: true,
              isLoading: false,
              phase: 'ready',
              durationSeconds: duration,
              error: null,
              errorMessage: null,
            }));
          }
        } catch {
          // Native statusChange will follow if status is not yet readable.
        }
      } catch (error) {
        if (cancelled || gen !== resolveGenRef.current || !mountedRef.current) {
          return;
        }
        watchdogRef.current?.clear();
        const code =
          error instanceof PlaybackError
            ? error.code
            : sourceRef.current
              ? 'PLAYER_INIT_FAILED'
              : normalizePlayerError(error).code;
        applyTerminalError(code);
      }
    })();

    return () => {
      cancelled = true;
      loadArmedRef.current = false;
      watchdogRef.current?.dispose();
      watchdogRef.current = null;
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [mediaId, loadNonce, player, safeSetSession, applyTerminalError]);

  // Cleanup on unmount / media exit.
  useEffect(() => {
    return () => {
      const id = sourceRef.current?.mediaId ?? mediaId;
      const position = (() => {
        try {
          return player.currentTime;
        } catch {
          return 0;
        }
      })();
      if (id) {
        emitPlaybackEvent({
          type: 'playerExited',
          mediaId: id,
          positionSeconds: Number.isFinite(position) ? position : 0,
          at: Date.now(),
        });
      }
      playerLog('player.disposed', { mediaId: id ?? undefined });
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [mediaId, player]);

  // Native controller lifetime matches the screen, not media switches.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      loadArmedRef.current = false;
      watchdogRef.current?.dispose();
      watchdogRef.current = null;
      try {
        controller.dispose();
      } catch {
        // ignore
      }
    };
  }, [controller]);

  // Background / screen-lock → pause; foreground → no autoplay.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (!mountedRef.current) {
        return;
      }
      const decision = decideAppLifecycleAction({
        nextState: next,
        isPlaying: sessionRef.current.isPlaying,
      });
      if (decision.action === 'background_pause') {
        try {
          player.pause();
        } catch {
          // ignore
        }
        const id = sourceRef.current?.mediaId;
        const position = Number.isFinite(player.currentTime)
          ? player.currentTime
          : sessionRef.current.positionSeconds;
        playerLog('player.background_pause', {
          mediaId: id ?? undefined,
        });
        if (id) {
          emitPlaybackEvent({
            type: 'paused',
            mediaId: id,
            positionSeconds: position,
            at: Date.now(),
          });
        }
        wasPlayingRef.current = false;
        safeSetSession((prev) => ({
          ...prev,
          isPlaying: false,
        }));
      }
      // foreground_no_autoplay: intentionally no play()
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
    };
  }, [player, safeSetSession]);

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (!mountedRef.current) {
      return;
    }
    if (status === 'error') {
      if (!loadArmedRef.current && sourceRef.current == null) {
        return;
      }
      watchdogRef.current?.clear();
      const code = classifyNativePlayerError(error);
      applyTerminalError(code);
      return;
    }
    if (
      !isCurrentPlayerSession({
        mounted: mountedRef.current,
        loadArmed: loadArmedRef.current,
        capturedGeneration: resolveGenRef.current,
        currentGeneration: resolveGenRef.current,
        activeMediaId: sourceRef.current?.mediaId ?? null,
      })
    ) {
      return;
    }
    if (status === 'readyToPlay') {
      watchdogRef.current?.clear();
      const duration =
        Number.isFinite(player.duration) && player.duration > 0
          ? player.duration
          : null;
      playerLog('player.ready', {
        mediaId: sourceRef.current?.mediaId,
        duration: duration ?? undefined,
      });
      safeSetSession((prev) => ({
        ...prev,
        isReady: true,
        isLoading: false,
        phase: seekingRef.current ? 'seeking' : 'ready',
        durationSeconds: duration,
        error: null,
        errorMessage: null,
      }));
      return;
    }
    if (status === 'loading') {
      safeSetSession((prev) => ({
        ...prev,
        isLoading: true,
        phase: prev.phase === 'resolving' ? 'resolving' : 'preparing',
      }));
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (
      !isCurrentPlayerSession({
        mounted: mountedRef.current,
        loadArmed: loadArmedRef.current,
        capturedGeneration: resolveGenRef.current,
        currentGeneration: resolveGenRef.current,
        activeMediaId: sourceRef.current?.mediaId ?? null,
      })
    ) {
      return;
    }
    const id = sourceRef.current?.mediaId;
    const playing = isPlaying === true;
    safeSetSession((prev) => ({
      ...prev,
      isPlaying: playing,
    }));
    if (playing && id && !startedEmittedRef.current) {
      startedEmittedRef.current = true;
      playerLog('player.play', { mediaId: id });
      emitPlaybackEvent({
        type: 'playbackStarted',
        mediaId: id,
        at: Date.now(),
      });
    }
    if (!playing && id && wasPlayingRef.current) {
      const position = Number.isFinite(player.currentTime)
        ? player.currentTime
        : 0;
      playerLog('player.pause', { mediaId: id });
      emitPlaybackEvent({
        type: 'paused',
        mediaId: id,
        positionSeconds: position,
        at: Date.now(),
      });
    }
    wasPlayingRef.current = playing;
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (
      !isCurrentPlayerSession({
        mounted: mountedRef.current,
        loadArmed: loadArmedRef.current,
        capturedGeneration: resolveGenRef.current,
        currentGeneration: resolveGenRef.current,
        activeMediaId: sourceRef.current?.mediaId ?? null,
      }) ||
      seekingRef.current
    ) {
      return;
    }
    const duration =
      Number.isFinite(player.duration) && player.duration > 0
        ? player.duration
        : null;
    const position = Number.isFinite(currentTime) ? currentTime : 0;
    safeSetSession((prev) => ({
      ...prev,
      positionSeconds: position,
      durationSeconds: duration ?? prev.durationSeconds,
    }));

    const id = sourceRef.current?.mediaId;
    const now = Date.now();
    if (id && now - lastPositionEmitRef.current >= 1000) {
      lastPositionEmitRef.current = now;
      emitPlaybackEvent({
        type: 'positionChanged',
        mediaId: id,
        positionSeconds: position,
        durationSeconds: duration,
        at: now,
      });
    }
  });

  useEventListener(player, 'playToEnd', () => {
    if (
      !isCurrentPlayerSession({
        mounted: mountedRef.current,
        loadArmed: loadArmedRef.current,
        capturedGeneration: resolveGenRef.current,
        currentGeneration: resolveGenRef.current,
        activeMediaId: sourceRef.current?.mediaId ?? null,
      })
    ) {
      return;
    }
    const id = sourceRef.current?.mediaId;
    if (!id || completionEmittedRef.current) {
      return;
    }
    completionEmittedRef.current = true;
    playerLog('player.completed', { mediaId: id });
    safeSetSession((prev) => ({
      ...prev,
      isPlaying: false,
      isCompleted: true,
      positionSeconds:
        prev.durationSeconds != null
          ? prev.durationSeconds
          : prev.positionSeconds,
    }));
    emitPlaybackEvent({
      type: 'completed',
      mediaId: id,
      at: Date.now(),
    });
  });

  const setPlaybackRate = useCallback(
    (rate: number): boolean => {
      const normalized = normalizePlaybackRate(rate);
      if (normalized == null) {
        return false;
      }
      controller.setPlaybackRate(normalized);
      safeSetSession((prev) => ({
        ...prev,
        playbackRate: normalized,
      }));
      return true;
    },
    [controller, safeSetSession],
  );

  const setVolume = useCallback(
    (volume: number): boolean => {
      const next = applyVolumeChange(volumeRef.current, volume);
      if (!next) {
        return false;
      }
      volumeRef.current = next;
      controller.setVolume(next.volume);
      controller.setMuted(next.isMuted);
      safeSetSession((prev) => ({
        ...prev,
        volume: next.volume,
        isMuted: next.isMuted,
      }));
      return true;
    },
    [controller, safeSetSession],
  );

  const mute = useCallback(() => {
    const next = applyMute(volumeRef.current);
    volumeRef.current = next;
    controller.setMuted(true);
    safeSetSession((prev) => ({
      ...prev,
      isMuted: true,
      volume: next.volume,
    }));
  }, [controller, safeSetSession]);

  const unmute = useCallback(() => {
    const next = applyUnmute(volumeRef.current);
    volumeRef.current = next;
    controller.setVolume(next.volume);
    controller.setMuted(false);
    safeSetSession((prev) => ({
      ...prev,
      isMuted: false,
      volume: next.volume,
    }));
  }, [controller, safeSetSession]);

  const toggleMute = useCallback(() => {
    if (volumeRef.current.isMuted || volumeRef.current.volume === 0) {
      unmute();
    } else {
      mute();
    }
  }, [mute, unmute]);

  const replay = useCallback(() => {
    completionEmittedRef.current = false;
    safeSetSession((prev) => ({
      ...prev,
      isCompleted: false,
      positionSeconds: 0,
      error: null,
      errorMessage: null,
    }));
    controller.seekTo(0);
    controller.play();
  }, [controller, safeSetSession]);

  const retry = useCallback(() => {
    if (!mediaId) {
      return;
    }
    playerLog('player.retry', { mediaId });
    completionEmittedRef.current = false;
    startedEmittedRef.current = false;
    setLoadNonce((n) => n + 1);
  }, [mediaId]);

  const beginSeekPreview = useCallback(
    (seconds: number) => {
      seekingRef.current = true;
      seekPreviewRef.current = seconds;
      setSeekPreviewSeconds(seconds);
      safeSetSession((prev) => ({
        ...prev,
        isSeeking: true,
        phase: 'seeking',
        isCompleted: false,
      }));
    },
    [safeSetSession],
  );

  const updateSeekPreview = useCallback((seconds: number) => {
    if (!seekingRef.current) {
      return;
    }
    seekPreviewRef.current = seconds;
    setSeekPreviewSeconds(seconds);
  }, []);

  const commitSeekPreview = useCallback(() => {
    const target = seekPreviewRef.current;
    seekingRef.current = false;
    seekPreviewRef.current = null;
    setSeekPreviewSeconds(null);
    if (target != null) {
      controller.seekTo(target);
      playerLog('player.seek', {
        mediaId: sourceRef.current?.mediaId,
        position: Math.floor(target),
      });
      safeSetSession((prev) => ({
        ...prev,
        positionSeconds: target,
        isSeeking: false,
        phase: prev.isReady ? 'ready' : prev.phase,
      }));
    } else {
      safeSetSession((prev) => ({
        ...prev,
        isSeeking: false,
        phase: prev.isReady ? 'ready' : prev.phase,
      }));
    }
  }, [controller, safeSetSession]);

  const cancelSeekPreview = useCallback(() => {
    seekingRef.current = false;
    seekPreviewRef.current = null;
    setSeekPreviewSeconds(null);
    safeSetSession((prev) => ({
      ...prev,
      isSeeking: false,
      phase: prev.isReady ? 'ready' : prev.phase,
    }));
  }, [safeSetSession]);

  return {
    session,
    controller,
    player,
    resolveGeneration,
    seekPreviewSeconds,
    beginSeekPreview,
    updateSeekPreview,
    commitSeekPreview,
    cancelSeekPreview,
    setPlaybackRate,
    setVolume,
    mute,
    unmute,
    toggleMute,
    replay,
    retry,
  };
}

export { SEEK_STEP_SECONDS };
