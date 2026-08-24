import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { realtimePollingController } from '@/realtime/polling';

/**
 * While Queue / Details / Downloads screens are focused and WS is down,
 * enable bounded polling. Releases on blur.
 */
export function useRealtimePollingInterest(
  reason: 'queue' | 'details' | 'downloads',
  enabled = true,
): void {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return;
      }
      return realtimePollingController.acquire(reason);
    }, [enabled, reason]),
  );
}
