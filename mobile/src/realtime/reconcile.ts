import { useDownloadsStore } from '@/store/downloads';
import { realtimeClientLog } from './diagnostics';

/**
 * Fetch durable downloads via existing store refresh.
 * Idempotent — safe after every reconnect. Does not invent state from WS gaps.
 */
export async function reconcileDownloadsFromApi(): Promise<void> {
  try {
    await useDownloadsStore.getState().refresh();
    realtimeClientLog('reconciliation.success', {
      count: useDownloadsStore.getState().orderedIds.length,
    });
  } catch (error) {
    realtimeClientLog(
      'reconciliation.failure',
      {
        error: error instanceof Error ? error.message : 'reconcile_failed',
      },
      'warn',
    );
    throw error;
  }
}
