import { Image } from 'expo-image';
import { memo, useCallback, useState } from 'react';

import { Box } from '@/components/base/Box';
import { Icon } from '@/components/base/Icon';
import { Pressable } from '@/components/base/Pressable';
import { Text } from '@/components/base/Text';
import type { MediaLibraryItem } from '@/library';

import { useTranslation } from '@/localization';

import { libraryTokens } from '../theme/library-tokens';
import { buildLibraryMetaLine } from '../utils/library-format';

export type LibraryCardProps = {
  item: MediaLibraryItem;
  onPress?: (id: string) => void;
  testID?: string;
};

export const LibraryCard = memo(function LibraryCard({
  item,
  onPress,
  testID,
}: LibraryCardProps) {
  const { t } = useTranslation();
  const [thumbFailed, setThumbFailed] = useState(false);
  const metaLine = buildLibraryMetaLine(item);

  const handlePress = useCallback(() => {
    onPress?.(item.id);
  }, [item.id, onPress]);

  const accessibilityParts = [
    item.displayName,
    metaLine,
    item.favorite ? t('library.favoriteA11y') : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={onPress ? handlePress : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityParts.join('. ')}
      accessibilityHint={onPress ? 'Opens video player' : undefined}
      testID={testID}
      style={({ pressed }) => ({
        paddingHorizontal: libraryTokens.spacing.screenX,
        paddingVertical: libraryTokens.spacing.rowY,
        backgroundColor: pressed && onPress ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
      })}>
      <Box row gap={12} style={{ alignItems: 'flex-start', minWidth: 0 }}>
        <Box
          style={{
            width: libraryTokens.thumbnailSize,
            height: libraryTokens.thumbnailSize,
            borderRadius: libraryTokens.radius.thumbnail,
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityIgnoresInvertColors>
          {item.thumbnailUri && !thumbFailed ? (
            <Image
              source={{ uri: item.thumbnailUri }}
              recyclingKey={item.id}
              cachePolicy="memory-disk"
              transition={200}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              onError={() => setThumbFailed(true)}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Icon name="video-outline" size="md" color="secondary" />
          )}
        </Box>

        <Box flex={1} gap={6} style={{ minWidth: 0 }}>
          <Box row gap={8} style={{ alignItems: 'flex-start' }}>
            <Text variant="body" numberOfLines={2} style={{ flex: 1 }}>
              {item.displayName}
            </Text>
            {item.favorite ? (
              <Icon
                name="heart"
                size="sm"
                color="error"
                accessibilityLabel={t('library.favoriteA11y')}
              />
            ) : null}
          </Box>
          {metaLine ? (
            <Text variant="caption" color="textSecondary" numberOfLines={2}>
              {metaLine}
            </Text>
          ) : null}
        </Box>
      </Box>
    </Pressable>
  );
});
