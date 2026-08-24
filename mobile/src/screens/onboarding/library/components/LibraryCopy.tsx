import { memo } from 'react';
import { Text } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { LIBRARY_LAYOUT } from '../constants';
import { libraryStyles } from '../styles';

type LibraryCopyProps = {
  opacity: SharedValue<number>;
  translateY: SharedValue<number>;
};

export const LibraryCopy = memo(function LibraryCopy({ opacity, translateY }: LibraryCopyProps) {
  const { t } = useTranslation();
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const a11yLabel = t('onboarding.libraryA11y');

  return (
    <Animated.View style={[libraryStyles.copy, style]}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={a11yLabel}
        style={[libraryStyles.title, { fontFamily: fontFamilies.heading }]}
        maxFontSizeMultiplier={LIBRARY_LAYOUT.maxFontMultiplier}>
        {t('onboarding.libraryTitleLead')}{' '}
        <Text style={libraryStyles.titleAccent}>{t('onboarding.libraryTitleAccent')}</Text>
        {'\n'}
        {t('onboarding.libraryTitleTrail')}
      </Text>

      <Text
        style={[libraryStyles.subtitle, { fontFamily: fontFamilies.body }]}
        maxFontSizeMultiplier={LIBRARY_LAYOUT.maxFontMultiplier}
        numberOfLines={2}>
        {t('onboarding.librarySubtitle')}
      </Text>
    </Animated.View>
  );
});
