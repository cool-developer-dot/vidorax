import { downloadAppLifecycle } from '@/downloads/execution/app-lifecycle';
import { useDownloadsStore } from '@/store/downloads';
import { downloadRealtimeClient } from './client';
import { realtimeClientLog } from './diagnostics';
import { REALTIME_CLIENT, type RealtimeConnectionState } from './types';

type PollReason = 'queue' | 'details' | 'downloads';

/**
 * Polling fallback while WebSocket is unavailable.
 * Screens register interest; only polls when foregrounded + interested + WS down.
 */
class RealtimePollingController {
  private readonly interests = new Map<PollReason, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private stateUnsub: (() => void) | null = null;
  private lifecycleUnsub: (() => void) | null = null;
  private active = false;
  private refreshing = false;

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.stateUnsub = downloadRealtimeClient.subscribeState((state) => {
      this.onConnectionState(state);
    });
    this.lifecycleUnsub = downloadAppLifecycle.subscribe((event) => {
      if (event.becameActive || event.leftForeground) {
        this.reevaluate();
      }
    });
    this.reevaluate();
  }

  stop(): void {
    this.active = false;
    this.stateUnsub?.();
    this.stateUnsub = null;
    this.lifecycleUnsub?.();
    this.lifecycleUnsub = null;
    this.stopPolling('dispose');
    this.interests.clear();
  }

  /** Screen focus: acquire interest. Returns release callback. */
  acquire(reason: PollReason): () => void {
    this.interests.set(reason, (this.interests.get(reason) ?? 0) + 1);
    this.reevaluate();
    return () => {
      const current = this.interests.get(reason) ?? 0;
      if (current <= 1) {
        this.interests.delete(reason);
      } else {
        this.interests.set(reason, current - 1);
      }
      this.reevaluate();
    };
  }

  private onConnectionState(state: RealtimeConnectionState): void {
    if (state === 'connected') {
      this.stopPolling('ws_connected');
      return;
    }
    this.reevaluate();
  }

  private reevaluate(): void {
    if (!this.active) {
      return;
    }

    const wsConnected = downloadRealtimeClient.isConnected();
    const foreground = downloadAppLifecycle.getPhase() === 'active';
    const interested = this.interests.size > 0;

    if (wsConnected || !foreground || !interested) {
      this.stopPolling(
        wsConnected
          ? 'ws_connected'
          : !foreground
            ? 'background'
            : 'no_interest',
      );
      return;
    }

    this.startPolling();
  }

  private startPolling(): void {
    if (this.timer) {
      return;
    }
    realtimeClientLog('polling_fallback.start', {
      reasons: [...this.interests.keys()].join(','),
    });
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, REALTIME_CLIENT.pollingIntervalMs);
  }

  private stopPolling(reason: string): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
    realtimeClientLog('polling_fallback.stop', { reason });
  }

  private async tick(): Promise<void> {
    if (this.refreshing) {
      return;
    }
    if (downloadRealtimeClient.isConnected()) {
      this.stopPolling('ws_connected');
      return;
    }
    if (downloadAppLifecycle.getPhase() !== 'active') {
      this.stopPolling('background');
      return;
    }
    if (this.interests.size === 0) {
      this.stopPolling('no_interest');
      return;
    }

    this.refreshing = true;
    try {
      await useDownloadsStore.getState().refresh();
    } catch {
      // soft fail — next tick retries
    } finally {
      this.refreshing = false;
    }
  }
}

export const realtimePollingController = new RealtimePollingController();
