import { memo, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Box } from '@/components/base/Box';
import { IconButton } from '@/components/buttons/IconButton';
import { Text } from '@/components/base/Text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/localization';

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  actions?: ReactNode;
  avatarUri?: string;
  avatarLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const AppHeader = memo(function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBackPress,
  actions,
  avatarUri,
  avatarLabel,
  style,
  testID,
}: AppHeaderProps) {
  const theme = useTheme();
  const { t, rtl } = useTranslation();

  return (
    <Box
      testID={testID}
      row
      rtlRow
      center
      px={16}
      py={12}
      gap={12}
      backgroundColor="background"
      style={[ { borderBottomWidth: 1, borderBottomColor: theme.colors.divider }, style]}>
      {showBack ? (
        <IconButton
          icon={rtl.arrowBack}
          accessibilityLabel={t('common.goBack')}
          onPress={onBackPress}
          variant="ghost"
        />
      ) : null}
      {avatarUri || avatarLabel ? (
        <Avatar source={avatarUri} label={avatarLabel} size="sm" />
      ) : null}
      <Box flex={1} gap={2}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {actions}
    </Box>
  );
});
