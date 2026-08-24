import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Pressable } from '@/components/base/Pressable';
import { useTranslation } from '@/localization';
import { fontFamilies } from '@/theme/typography';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

type ForgotPasswordLinkProps = {
  disabled?: boolean;
  onPress: () => void;
};

export const ForgotPasswordLink = memo(function ForgotPasswordLink({
  disabled = false,
  onPress,
}: ForgotPasswordLinkProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="link"
      accessibilityLabel={t('auth.forgotPassword')}
      pressedOpacity={0.7}
      style={styles.hit}>
      <Text
        style={[styles.label, { fontFamily: fontFamilies.bodySemiBold }]}
        maxFontSizeMultiplier={AUTH_LAYOUT.maxFontMultiplier}>
        {t('auth.forgotPassword')}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  label: {
    color: AUTH_COLORS.accent,
    fontSize: 13,
    letterSpacing: 0.15,
    textAlign: 'right',
  },
});
