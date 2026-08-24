import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

export const AuthDivider = memo(function AuthDivider() {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={t('common.or')}>
      <View style={styles.line} />
      <Text
        style={[styles.label, { fontFamily: fontFamilies.body }]}
        maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
        {t('common.or')}
      </Text>
      <View style={styles.line} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: AUTH_COLORS.divider,
  },
  label: {
    color: AUTH_COLORS.muted,
    fontSize: 12,
    letterSpacing: 1.4,
  },
});
