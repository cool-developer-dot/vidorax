/**
 * Stage 2 player screen — composition / chrome only.
 * Session, resolver, and engine stay in `@/player`.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Box } from '@/components/base/Box';
import { Text } from '@/components/base/Text';
import { SafeAreaScreen } from '@/components/common/SafeAreaScreen';
import { ErrorState } from '@/components/common/ErrorState';
import { Loader } from '@/components/common/Loader';
import { useTheme } from '@/hooks/use-theme';
import { localizePlayerError, useTranslation } from '@/localization';
import {
  formatPlaybackRateLabel,
  isRecoverablePlayerError,
  parseRouteMediaId,
  SEEK_FEEDBACK_MS,
  SEEK_STEP_SECONDS,
  type DoubleTapSeekSide,
  type PlaybackRate,
} from '@/player';
import { useControlsVisibility } from '@/player/use-controls-visibility';
import { useFullscreenLifecycle } from '@/player/use-fullscreen-lifecycle';
import { usePlayerSession } from '@/player/use-player-session';
import { useResumePrompt } from '@/playback/use-resume-prompt';
import { Button } from '@/components/buttons/Button';
import { getPlayerSupportContext } from '@/support';
import { openSupportWithContext } from '@/support/support-navigation';

import { PlayerControls } from './components/PlayerControls';
import { PlaybackSpeedSheet } from './components/PlaybackSpeedSheet';
import { PlayerTimeline } from './components/PlayerTimeline';
import { PlayerTopBar } from './components/PlayerTopBar';
import { PlayerVideoSurface } from './components/PlayerVideoSurface';
import {
  DoubleTapSeekFeedback,
  SeekFeedbackOverlay,
} from './components/SeekFeedback';

export const PlayerScreen = memo(function PlayerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const mediaId = parseRouteMediaId(params.id);

  const {
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
    toggleMute,
    replay,
    retry,
  } = usePlayerSession(mediaId);

  // Auto-resume seek runs inside the hook (no Resume/Start Over sheet).
  useResumePrompt({
    mediaId,
    isReady: session.isReady,
    resolveGeneration,
    controller,
    activeMediaId: session.mediaId ?? mediaId,
  });

  const {
    isFullscreen,
    exitFullscreen,
    toggleFullscreen,
    restorePresentation,
    handleAndroidBack,
  } = useFullscreenLifecycle();

  const [speedSheetOpen, setSpeedSheetOpen] = useState(false);
  const [doubleTapSide, setDoubleTapSide] = useState<DoubleTapSeekSide | null>(
    null,
  );

  const {
    controlsVisible,
    toggleControls,
    bumpControls,
    showControls,
  } = useControlsVisibility({
    isPlaying: session.isPlaying,
    isSeeking: session.isSeeking,
    isSpeedSheetOpen: speedSheetOpen,
    isVolumeInteracting: false,
    isLoading: session.isLoading || session.phase === 'preparing',
    hasError: Boolean(session.error),
    isCompleted: session.isCompleted,
  });

  useEffect(() => {
    if (session.error && isFullscreen) {
      void restorePresentation();
    }
  }, [session.error, isFullscreen, restorePresentation]);

  const leavePlayer = useCallback(async () => {
    try {
      controller.pause();
    } catch {
      // ignore
    }
    // Pause emits coordinator flush; unmount also emits playerExited.
    // Capture latest position before navigation tears down the surface.
    await restorePresentation();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/library');
    }
  }, [controller, restorePresentation, router]);

  const onChromeBack = useCallback(() => {
    if (isFullscreen) {
      void exitFullscreen();
      return;
    }
    void leavePlayer();
  }, [exitFullscreen, isFullscreen, leavePlayer]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = handleAndroidBack();
      if (action === 'exit_fullscreen') {
        return true;
      }
      void leavePlayer();
      return true;
    });
    return () => sub.remove();
  }, [handleAndroidBack, leavePlayer]);

  const onPlayPause = useCallback(() => {
    bumpControls();
    if (!session.isReady || session.error) {
      return;
    }
    if (session.isPlaying) {
      controller.pause();
    } else {
      controller.play();
    }
  }, [
    bumpControls,
    controller,
    session.error,
    session.isPlaying,
    session.isReady,
  ]);

  const onRewind = useCallback(() => {
    bumpControls();
    if (!session.isReady) {
      return;
    }
    controller.seekBy(-SEEK_STEP_SECONDS);
  }, [bumpControls, controller, session.isReady]);

  const onForward = useCallback(() => {
    bumpControls();
    if (!session.isReady) {
      return;
    }
    controller.seekBy(SEEK_STEP_SECONDS);
  }, [bumpControls, controller, session.isReady]);

  const onReplay = useCallback(() => {
    bumpControls();
    replay();
  }, [bumpControls, replay]);

  const onToggleMute = useCallback(() => {
    bumpControls();
    toggleMute();
  }, [bumpControls, toggleMute]);

  const onOpenSpeed = useCallback(() => {
    showControls();
    setSpeedSheetOpen(true);
  }, [showControls]);

  const onCloseSpeed = useCallback(() => {
    setSpeedSheetOpen(false);
    bumpControls();
  }, [bumpControls]);

  const onSelectSpeed = useCallback(
    (rate: PlaybackRate) => {
      setPlaybackRate(rate);
      bumpControls();
    },
    [bumpControls, setPlaybackRate],
  );

  const onSingleTap = useCallback(() => {
    if (speedSheetOpen || session.isSeeking) {
      return;
    }
    toggleControls();
  }, [session.isSeeking, speedSheetOpen, toggleControls]);

  const onDoubleTapSeek = useCallback(
    (side: DoubleTapSeekSide, delta: number) => {
      if (!session.isReady || session.error) {
        return;
      }
      controller.seekBy(delta);
      setDoubleTapSide(side);
      bumpControls();
    },
    [bumpControls, controller, session.error, session.isReady],
  );

  useEffect(() => {
    if (!doubleTapSide) {
      return;
    }
    const timer = setTimeout(() => setDoubleTapSide(null), SEEK_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [doubleTapSide]);

  const onSeekStart = useCallback(
    (seconds: number) => {
      beginSeekPreview(seconds);
      showControls();
    },
    [beginSeekPreview, showControls],
  );

  const onSeekCommit = useCallback(() => {
    commitSeekPreview();
    bumpControls();
  }, [bumpControls, commitSeekPreview]);

  const onSeekCancel = useCallback(() => {
    cancelSeekPreview();
    bumpControls();
  }, [bumpControls, cancelSeekPreview]);

  const title = session.displayName ?? t('player.untitled');
  const showResolving = session.phase === 'resolving' && !session.error;
  const showError = session.phase === 'error' && session.error != null;
  const overlayVisible = controlsVisible || session.isSeeking || speedSheetOpen;

  const body = (
    <View
      style={[
        styles.body,
        isFullscreen ? styles.fullscreenBody : null,
        { backgroundColor: theme.colors.black },
      ]}>
      <View style={styles.stage}>
        {showResolving ? (
          <Box flex={1} center gap={12}>
            <Loader size="large" accessibilityLabel={t('player.preparing')} />
            <Text variant="bodySmall" color="textSecondary">
              {t('player.preparing')}
            </Text>
          </Box>
        ) : (
          <>
            <PlayerVideoSurface
              player={player}
              gesturesEnabled={!speedSheetOpen}
              onSingleTap={onSingleTap}
              onDoubleTapSeek={onDoubleTapSeek}
            />
            {overlayVisible ? (
              <Animated.View
                entering={FadeIn.duration(160)}
                exiting={FadeOut.duration(160)}
                style={StyleSheet.absoluteFill}
                pointerEvents="box-none">
                <PlayerTopBar
                  title={title}
                  isFullscreen={isFullscreen}
                  visible
                  onBack={onChromeBack}
                  onToggleFullscreen={() => {
                    bumpControls();
                    void toggleFullscreen();
                  }}
                />
                <PlayerControls
                  isPlaying={session.isPlaying}
                  isReady={session.isReady}
                  isLoading={
                    session.isLoading || session.phase === 'preparing'
                  }
                  isCompleted={session.isCompleted}
                  isMuted={session.isMuted}
                  playbackRate={session.playbackRate}
                  disabled={Boolean(session.error)}
                  visible
                  onPlayPause={onPlayPause}
                  onRewind={onRewind}
                  onForward={onForward}
                  onReplay={onReplay}
                  onToggleMute={onToggleMute}
                  onOpenSpeed={onOpenSpeed}
                />
              </Animated.View>
            ) : null}
            <SeekFeedbackOverlay
              previewSeconds={seekPreviewSeconds}
              durationSeconds={session.durationSeconds}
              visible={session.isSeeking}
            />
            <DoubleTapSeekFeedback side={doubleTapSide} />
          </>
        )}
      </View>

      {(overlayVisible || session.isSeeking) && !showResolving ? (
        <Box
          px={16}
          pb={isFullscreen ? 12 : 16}
          pt={8}
          gap={4}
          style={styles.timelineDock}>
          <PlayerTimeline
            positionSeconds={session.positionSeconds}
            durationSeconds={session.durationSeconds}
            previewSeconds={seekPreviewSeconds}
            disabled={!session.isReady || Boolean(session.error)}
            onSeekStart={onSeekStart}
            onSeekChange={updateSeekPreview}
            onSeekCommit={onSeekCommit}
            onSeekCancel={onSeekCancel}
          />
          {session.isSeeking ? null : (
            <Text variant="caption" color="textSecondary">
              Speed {formatPlaybackRateLabel(session.playbackRate)}
              {session.isMuted ? ' · Muted' : ''}
            </Text>
          )}
        </Box>
      ) : null}
    </View>
  );

  return (
    <SafeAreaScreen
      padded={false}
      edges={isFullscreen ? [] : ['left', 'right', 'top', 'bottom']}
      style={{
        backgroundColor: isFullscreen
          ? theme.colors.black
          : theme.colors.background,
      }}>
      {showError ? (
        <Box flex={1} center p={24} gap={16}>
          <ErrorState
            title={
              session.error
                ? localizePlayerError(session.error).title
                : t('player.errors.PLAYBACK_FAILED.title')
            }
            message={
              session.error
                ? localizePlayerError(session.error).message
                : t('player.errors.PLAYBACK_FAILED.message')
            }
            retryLabel={
              session.error && isRecoverablePlayerError(session.error)
                ? t('common.retry')
                : undefined
            }
            onRetry={
              session.error && isRecoverablePlayerError(session.error)
                ? () => {
                    retry();
                  }
                : undefined
            }
          />
          <Button
            title={t('common.goBack')}
            variant="outline"
            onPress={() => {
              void leavePlayer();
            }}
            accessibilityLabel={t('player.goBack')}
          />
          <Button
            title={t('support.getHelp')}
            variant="outline"
            onPress={() => {
              openSupportWithContext(getPlayerSupportContext(session.error));
            }}
            accessibilityLabel={t('support.getHelpA11y')}
            accessibilityHint={t('support.getHelpHint')}
          />
        </Box>
      ) : (
        body
      )}

      <PlaybackSpeedSheet
        visible={speedSheetOpen}
        selectedRate={session.playbackRate}
        onSelect={onSelectSpeed}
        onClose={onCloseSpeed}
      />
    </SafeAreaScreen>
  );
});

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  fullscreenBody: {
    ...StyleSheet.absoluteFill,
  },
  stage: {
    flex: 1,
    position: 'relative',
  },
  timelineDock: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
