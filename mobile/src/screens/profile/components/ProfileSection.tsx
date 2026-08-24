import { memo, type PropsWithChildren, type ReactNode } from 'react';
import { View } from 'react-native';

import { Box } from '@/components/base/Box';
import { Icon, type IconName } from '@/components/base/Icon';
import { Text } from '@/components/base/Text';

import { useProfileTokens } from '../theme/profile-tokens';

export type ProfileSectionProps = PropsWithChildren<{
  title: string;
  description?: string;
  icon: IconName;
  /** Soften visual weight for secondary sections (e.g. Application). */
  secondary?: boolean;
  trailing?: ReactNode;
  testID?: string;
}>;

/**
 * Shared Profile section shell — icon, title, description, elevated card body.
 */
export const ProfileSection = memo(function ProfileSection({
  title,
  description,
  icon,
  secondary = false,
  trailing,
  children,
  testID,
}: ProfileSectionProps) {
  const profileTokens = useProfileTokens();
  return (
    <View testID={testID} accessibilityRole="summary">
      <Box row center gap={12} mb={12} style={{ alignItems: 'flex-start' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: profileTokens.radius.icon,
            backgroundColor: secondary
              ? profileTokens.actionIconBgMuted
              : profileTokens.sectionIconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no">
          <Icon
            name={icon}
            size="sm"
            color={secondary ? 'secondary' : 'primary'}
          />
        </View>
        <Box flex={1} gap={2} style={{ paddingTop: 2 }}>
          <Box row center style={{ justifyContent: 'space-between' }} gap={8}>
            <Text
              variant={secondary ? 'label' : 'subtitle'}
              accessibilityRole="header"
              style={
                secondary
                  ? {
                      fontSize: 15,
                      lineHeight: 20,
                      letterSpacing: 0.1,
                      color: profileTokens.textPrimary,
                    }
                  : {
                      letterSpacing: -0.2,
                      color: profileTokens.textPrimary,
                    }
              }>
              {title}
            </Text>
            {trailing}
          </Box>
          {description ? (
            <Text
              variant="caption"
              style={{
                lineHeight: 18,
                color: profileTokens.textSecondary,
              }}>
              {description}
            </Text>
          ) : null}
        </Box>
      </Box>

      <View
        style={[
          {
            backgroundColor: profileTokens.card,
            borderRadius: profileTokens.radius.card,
            borderWidth: 1,
            borderColor: profileTokens.cardBorder,
            paddingHorizontal: profileTokens.spacing.cardPadding,
            paddingVertical: secondary ? 4 : 6,
            overflow: 'hidden',
          },
          profileTokens.elevation.card,
        ]}>
        {children}
      </View>
    </View>
  );
});
