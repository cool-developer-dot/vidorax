import { memo, useCallback } from 'react';
import { Image } from 'expo-image';

import { Box } from '@/components/base/Box';
import { Pressable } from '@/components/base/Pressable';
import { Text } from '@/components/base/Text';
import { IconButton } from '@/components/buttons/IconButton';
import { Avatar } from '@/components/common/Avatar';
import { useTranslation } from '@/localization';
import { navigation, routePaths } from '@/navigation';
import { useHomeGreeting } from '../hooks/useHomeDashboard';
import { useHomeLayout } from '../theme/home-layout';

const HOME_LOGO = require('../../../../assets/logos/vidorax-logo.png');

export const HomeHeader = memo(function HomeHeader() {
  const layout = useHomeLayout();
  const greeting = useHomeGreeting();
  const { t } = useTranslation();

  const openProfile = useCallback(() => {
    navigation.push(routePaths.profile);
  }, []);

  const openSettings = useCallback(() => {
    navigation.navigate(routePaths.settings);
  }, []);

  return (
    <Box
      testID="home-header"
      row
      rtlRow
      center
      px={16}
      gap={12}
      backgroundColor="background"
      style={{
        paddingVertical: layout.headerY,
        borderBottomWidth: 1,
        borderBottomColor: layout.theme.colors.divider,
      }}>
      <Image
        source={HOME_LOGO}
        style={{ width: layout.logoSize, height: layout.logoSize }}
        contentFit="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Box flex={1} gap={2} style={{ minWidth: 0 }}>
        <Text variant="title" numberOfLines={1} accessibilityRole="header">
          {t('home.brand')}
        </Text>
        <Text
          variant="bodySmall"
          color="textSecondary"
          numberOfLines={1}
          accessibilityLabel={greeting.headline}>
          {greeting.headline}
        </Text>
      </Box>
      <IconButton
        icon="cog-outline"
        accessibilityLabel={t('home.openSettingsA11y')}
        onPress={openSettings}
        variant="ghost"
        testID="home-settings-button"
      />
      <Pressable
        onPress={openProfile}
        accessibilityRole="button"
        accessibilityLabel={t('home.openProfileA11y')}
        testID="home-profile-button"
        style={{
          minWidth: layout.touchTarget,
          minHeight: layout.touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Avatar
          source={greeting.avatarUrl}
          label={greeting.displayName ?? t('home.brand')}
          size="md"
          testID="home-header-avatar"
        />
      </Pressable>
    </Box>
  );
});
