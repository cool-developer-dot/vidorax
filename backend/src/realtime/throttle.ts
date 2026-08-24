import type { DownloadRealtimeEvent } from './types.js';
import { REALTIME_CONSTANTS } from './types.js';
import { isProgressOnlyEvent } from './event-mapper.js';

type FlushHandler = (event: DownloadRealtimeEvent) => void;

interface PendingSlot {
  event: DownloadRealtimeEvent;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Per-download progress coalescer.
 * Terminal / state-transition events flush immediately and cancel pending progress.
 */
export class ProgressEventThrottle {
  private readonly pending = new Map<string, PendingSlot>();
  private readonly intervalMs: number;
  private readonly onFlush: FlushHandler;

  constructor(
    onFlush: FlushHandler,
    intervalMs: number = REALTIME_CONSTANTS.progressThrottleMs,
  ) {
    this.onFlush = onFlush;
    this.intervalMs = intervalMs;
  }

  enqueue(event: DownloadRealtimeEvent): void {
    const key = event.downloadId;

    if (!isProgressOnlyEvent(event.type)) {
      this.clear(key);
      this.onFlush(event);
      return;
    }

    const existing = this.pending.get(key);
    if (existing) {
      existing.event = event;
      return;
    }

    const slot: PendingSlot = { event, timer: null };
    slot.timer = setTimeout(() => {
      this.pending.delete(key);
      this.onFlush(slot.event);
    }, this.intervalMs);
    this.pending.set(key, slot);
  }

  clear(downloadId: string): void {
    const slot = this.pending.get(downloadId);
    if (!slot) {
      return;
    }
    if (slot.timer) {
      clearTimeout(slot.timer);
    }
    this.pending.delete(downloadId);
  }

  flushAll(): void {
    for (const [key, slot] of this.pending) {
      if (slot.timer) {
        clearTimeout(slot.timer);
      }
      this.pending.delete(key);
      this.onFlush(slot.event);
    }
  }

  dispose(): void {
    for (const slot of this.pending.values()) {
      if (slot.timer) {
        clearTimeout(slot.timer);
      }
    }
    this.pending.clear();
  }
}
