import { memo, useCallback } from 'react';

import { Box } from '@/components/base/Box';
import { Pressable } from '@/components/base/Pressable';
import { Text } from '@/components/base/Text';
import { IconButton } from '@/components/buttons/IconButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { isPlaylistOrStreamUrl } from '@/downloads/engine';
import { useTranslation } from '@/localization';
import { useDownloadsStore } from '@/store/downloads';

import { downloadsTokens } from '../theme/downloads-tokens';
import {
  buildProgressMeta,
  formatDownloadFileSize,
  formatTransferSpeed,
  getExecutionStatusLabel,
} from '../utils/download-format';

export type QueueActiveRowProps = {
  id: string;
  onPress: (id: string) => void;
  onPause: (id: string) => void;
  onCancel: (id: string) => void;
  mutating?: boolean;
};

export const QueueActiveRow = memo(function QueueActiveRow({
  id,
  onPress,
  onPause,
  onCancel,
  mutating = false,
}: QueueActiveRowProps) {
  const { t } = useTranslation();
  const item = useDownloadsStore((s) => s.itemsById[id] ?? null);
  const transfer = useDownloadsStore((s) => s.transferById[id] ?? null);

  const handlePress = useCallback(() => onPress(id), [id, onPress]);
  const handlePause = useCallback(() => onPause(id), [id, onPause]);
  const handleCancel = useCallback(() => onCancel(id), [id, onCancel]);

  if (!item) {
    return null;
  }

  const title = item.title?.trim() || item.fileName?.trim() || t('downloads.untitled');
  const quality = item.quality?.trim() || null;
  const size = formatDownloadFileSize(item.fileSize);
  const progress =
    transfer?.progress != null ? transfer.progress : item.progress;
  const speed = formatTransferSpeed(transfer?.bytesPerSecond ?? null);
  const progressMeta = buildProgressMeta(item, transfer);
  const isHls = isPlaylistOrStreamUrl(item.sourceUrl);
  const canPause = !isHls && item.status === 'DOWNLOADING';

  const statusLabel = getExecutionStatusLabel({
    status: item.status,
    workerState: item.workerState,
    downloadId: id,
  });
  const metaParts = [quality, size].filter(Boolean);
  const a11y = [
    title,
    statusLabel,
    t('downloads.percentA11y', { percent: Math.round(progress) }),
    quality,
    speed,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      testID={`queue-active-${id}`}
      style={{
        minHeight: 72,
        paddingVertical: 12,
        paddingHorizontal: downloadsTokens.spacing.screenX,
        borderBottomWidth: 1,
        borderBottomColor: downloadsTokens.cardBorder,
      }}>
      <Box gap={8}>
        <Box row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box style={{ flex: 1, paddingRight: 12 }} gap={4}>
            <Text variant="label" numberOfLines={2}>
              {title}
            </Text>
            <Text
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              testID={`queue-active-status-${id}`}>
              {statusLabel}
            </Text>
            {metaParts.length > 0 ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {metaParts.join(' · ')}
              </Text>
            ) : null}
            {progressMeta ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {progressMeta}
              </Text>
            ) : null}
          </Box>
          <Box row gap={4} style={{ alignItems: 'center' }}>
            {canPause ? (
              <IconButton
                icon="pause"
                accessibilityLabel={t('downloads.pauseNamedA11y', { title })}
                onPress={handlePause}
                disabled={mutating}
                variant="ghost"
                testID={`queue-active-pause-${id}`}
              />
            ) : null}
            <IconButton
              icon="close"
              accessibilityLabel={t('downloads.cancelNamedA11y', { title })}
              onPress={handleCancel}
              disabled={mutating}
              variant="ghost"
              testID={`queue-active-cancel-${id}`}
            />
          </Box>
        </Box>
        <ProgressBar progress={progress / 100} />
      </Box>
    </Pressable>
  );
});
