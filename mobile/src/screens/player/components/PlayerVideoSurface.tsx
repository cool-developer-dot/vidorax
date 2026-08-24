import { memo, useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { VideoView, type VideoPlayer } from 'expo-video';

import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/localization';
import {
  doubleTapSeekDelta,
  resolveDoubleTapSide,
  type DoubleTapSeekSide,
} from '@/player';

export type PlayerVideoSurfaceProps = {
  player: VideoPlayer;
  gesturesEnabled?: boolean;
  onSingleTap?: () => void;
  onDoubleTapSeek?: (side: DoubleTapSeekSide, deltaSeconds: number) => void;
};

export const PlayerVideoSurface = memo(function PlayerVideoSurface({
  player,
  gesturesEnabled = true,
  onSingleTap,
  onDoubleTapSeek,
}: PlayerVideoSurfaceProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const handleSingleTap = useCallback(() => {
    onSingleTap?.();
  }, [onSingleTap]);

  const handleDoubleTap = useCallback(
    (x: number) => {
      const side = resolveDoubleTapSide(x, width);
      if (!side) {
        return;
      }
      onDoubleTapSeek?.(side, doubleTapSeekDelta(side));
    },
    [onDoubleTapSeek, width],
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .enabled(gesturesEnabled)
        .onEnd((event) => {
          runOnJS(handleDoubleTap)(event.x);
        }),
    [gesturesEnabled, handleDoubleTap],
  );

  const singleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .maxDuration(250)
        .enabled(gesturesEnabled)
        .onEnd(() => {
          runOnJS(handleSingleTap)();
        }),
    [gesturesEnabled, handleSingleTap],
  );

  // Double tap has priority over single tap.
  const gesture = useMemo(
    () => Gesture.Exclusive(doubleTap, singleTap),
    [doubleTap, singleTap],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.surface, { backgroundColor: theme.colors.black }]}
        onLayout={onLayout}
        accessibilityLabel={t('player.videoSurfaceA11y')}
        accessibilityHint={t('player.surfaceHint')}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          pointerEvents="none"
        />
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  video: {
    flex: 1,
    width: '100%',
  },
});
