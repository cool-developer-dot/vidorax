import type { DownloadItem } from '@/api';
import { normalizeDownloadItem } from '@/store/downloads';
import {
  eventToDownloadPatch,
  shouldApplyRealtimeEvent,
  skeletonItemFromEvent,
} from './ordering';
import type { DownloadRealtimeEvent } from './types';

export {
  eventToDownloadPatch,
  shouldApplyRealtimeEvent,
  skeletonItemFromEvent,
} from './ordering';

/**
 * Merge event into existing item for upsert. Uses normalizeDownloadItem path.
 */
export function mergeEventIntoItem(
  event: DownloadRealtimeEvent,
  existing: DownloadItem | null | undefined,
): DownloadItem | null {
  const patch = eventToDownloadPatch(event, existing);
  const base = existing ?? skeletonItemFromEvent(event);
  return normalizeDownloadItem({
    ...base,
    ...patch,
  });
}
