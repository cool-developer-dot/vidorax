import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontFamilies } from '@/theme/typography';

import { ONBOARDING_COLORS } from '../constants';

type OnboardingPlaceholderProps = {
  title: string;
  subtitle: string;
};

/**
 * Lightweight reserved pages for future onboarding steps (2–3).
 * Keeps the 3-dot pager honest without diluting Screen 1 quality.
 */
export const OnboardingPlaceholder = memo(function OnboardingPlaceholder({
  title,
  subtitle,
}: OnboardingPlaceholderProps) {
  return (
    <View style={styles.root} accessibilityLabel={title}>
      <Text style={[styles.title, { fontFamily: fontFamilies.heading }]}>{title}</Text>
      <Text style={[styles.subtitle, { fontFamily: fontFamilies.body }]}>{subtitle}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ONBOARDING_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: ONBOARDING_COLORS.active,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 12,
    color: ONBOARDING_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
});
