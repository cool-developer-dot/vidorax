import { Image } from 'expo-image';
import { memo, useCallback, useState } from 'react';

import { Box } from '@/components/base/Box';
import { Icon } from '@/components/base/Icon';
import { Pressable } from '@/components/base/Pressable';
import { Text } from '@/components/base/Text';
import type { MediaLibraryItem } from '@/library';

import { useTranslation } from '@/localization';

import { libraryTokens } from '../theme/library-tokens';
import { buildLibraryGridMeta } from '../utils/library-format';

export type LibraryGridTileProps = {
  item: MediaLibraryItem;
  width: number;
  onPress?: (id: string) => void;
  testID?: string;
};

export const LibraryGridTile = memo(function LibraryGridTile({
  item,
  width,
  onPress,
  testID,
}: LibraryGridTileProps) {
  const { t } = useTranslation();
  const [thumbFailed, setThumbFailed] = useState(false);
  const meta = buildLibraryGridMeta(item);

  const handlePress = useCallback(() => {
    onPress?.(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable
      onPress={onPress ? handlePress : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[item.displayName, meta, item.favorite ? t('library.favoriteA11y') : null]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={onPress ? 'Opens video player' : undefined}
      testID={testID}
      style={({ pressed }) => ({
        width,
        opacity: pressed && onPress ? 0.88 : 1,
      })}>
      <Box
        style={{
          borderRadius: libraryTokens.radius.tile,
          overflow: 'hidden',
          backgroundColor: 'rgba(37, 99, 235, 0.06)',
        }}>
        <Box
          style={{
            width: '100%',
            height: libraryTokens.gridThumbnailHeight,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
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
            <Icon name="video-outline" size="lg" color="secondary" />
          )}
          {item.favorite ? (
            <Box
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
              }}>
              <Icon name="heart" size="sm" color="error" accessibilityLabel={t('library.favoriteA11y')} />
            </Box>
          ) : null}
        </Box>
        <Box p={8} gap={4}>
          <Text variant="label" numberOfLines={2}>
            {item.displayName}
          </Text>
          {meta ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </Box>
      </Box>
    </Pressable>
  );
});
