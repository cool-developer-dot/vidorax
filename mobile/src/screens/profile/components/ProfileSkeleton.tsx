import { memo } from 'react';
import { View } from 'react-native';

import { Box } from '@/components/base/Box';
import { Skeleton } from '@/components/common/Skeleton';
import { useTranslation } from '@/localization';

import { useProfileTokens } from '../theme/profile-tokens';

export type ProfileSkeletonProps = {
  testID?: string;
};

function SkeletonCard({ rows, secondary }: { rows: number; secondary?: boolean }) {
  const profileTokens = useProfileTokens();
  return (
    <View style={{ marginBottom: 8 }}>
      <Box row center gap={12} mb={12}>
        <Skeleton width={36} height={36} borderRadius={profileTokens.radius.icon} />
        <Box flex={1} gap={6}>
          <Skeleton width="42%" height={secondary ? 12 : 16} />
          <Skeleton width="58%" height={10} />
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
            paddingVertical: 8,
          },
          profileTokens.elevation.card,
        ]}>
        {Array.from({ length: rows }, (_, index) => (
          <Box key={`sk-${index}`} gap={8} py={14}>
            <Skeleton width="28%" height={10} />
            <Skeleton width={secondary ? '40%' : '64%'} height={secondary ? 12 : 16} />
            {index < rows - 1 ? (
              <View
                style={{
                  height: 1,
                  marginTop: 6,
                  backgroundColor: profileTokens.divider,
                }}
              />
            ) : null}
          </Box>
        ))}
      </View>
    </View>
  );
}

export const ProfileSkeleton = memo(function ProfileSkeleton({
  testID = 'profile-skeleton',
}: ProfileSkeletonProps) {
  const profileTokens = useProfileTokens();
  const { t } = useTranslation();
  return (
    <Box
      testID={testID}
      gap={28}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('profile.loadingA11y')}
      accessibilityState={{ busy: true }}
      style={{ paddingTop: 8 }}>
      <Box center gap={16} py={24}>
        <Skeleton
          width={112}
          height={112}
          borderRadius={profileTokens.radius.avatar}
          testID={`${testID}-avatar`}
        />
        <Skeleton width="36%" height={12} />
        <Skeleton width="52%" height={28} />
        <Skeleton width="64%" height={14} />
        <Skeleton width={88} height={24} borderRadius={999} />
        <Skeleton width="40%" height={12} />
      </Box>

      <SkeletonCard rows={3} />
      <SkeletonCard rows={3} secondary />
      <SkeletonCard rows={4} />
    </Box>
  );
});
