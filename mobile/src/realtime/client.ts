import { environment } from '@/constants/environment';
import { getAccessToken } from '@/api/token';
import { refreshSession } from '@/services/auth/token-refresh.service';
import { downloadAppLifecycle } from '@/downloads/execution/app-lifecycle';
import { realtimeClientLog } from './diagnostics';
import { parseDownloadRealtimeEvent } from './validate';
import {
  REALTIME_CLIENT,
  type DownloadRealtimeEvent,
  type RealtimeConnectionState,
} from './types';

export type RealtimeEventListener = (event: DownloadRealtimeEvent) => void;
export type RealtimeStateListener = (state: RealtimeConnectionState) => void;
export type RealtimeReconcileHandler = () => Promise<void>;

function resolveWsConnection(accessToken: string): {
  url: string;
  protocols: string[];
} {
  const base = environment.apiBaseUrl.replace(/\/+$/, '');
  const wsBase = base.replace(/^http/i, (m) =>
    m.toLowerCase() === 'https' ? 'wss' : 'ws',
  );
  // Prefer Sec-WebSocket-Protocol — avoid putting JWT in query/proxy logs.
  const url = `${wsBase}${REALTIME_CLIENT.path}`;
  return {
    url,
    protocols: ['bearer', accessToken],
  };
}

function jitteredBackoff(attempt: number): number {
  const exp = Math.min(
    REALTIME_CLIENT.reconnectMaxMs,
    REALTIME_CLIENT.reconnectBaseMs * 2 ** Math.max(0, attempt),
  );
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(REALTIME_CLIENT.reconnectMaxMs, exp + jitter);
}

/**
 * Singleton WebSocket transport for download ledger events.
 * Screens must not open their own sockets.
 */
class DownloadRealtimeClient {
  private socket: WebSocket | null = null;
  private state: RealtimeConnectionState = 'idle';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private started = false;
  private lifecycleUnsub: (() => void) | null = null;
  private authRefreshInFlight = false;

  private readonly eventListeners = new Set<RealtimeEventListener>();
  private readonly stateListeners = new Set<RealtimeStateListener>();
  private reconcileHandler: RealtimeReconcileHandler | null = null;
  private readonly seenEventIds = new Set<string>();
  private seenEventQueue: string[] = [];

  getConnectionState(): RealtimeConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  setReconcileHandler(handler: RealtimeReconcileHandler | null): void {
    this.reconcileHandler = handler;
  }

  subscribeEvents(listener: RealtimeEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  subscribeState(listener: RealtimeStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /** Idempotent start — one logical connection for the app. */
  start(): void {
    if (this.started) {
      this.ensureConnected();
      return;
    }
    this.started = true;
    this.intentionalClose = false;
    this.lifecycleUnsub = downloadAppLifecycle.subscribe((event) => {
      if (event.becameActive) {
        this.intentionalClose = false;
        this.ensureConnected();
        return;
      }
      if (event.leftForeground && event.phase === 'background') {
        // Avoid reconnect storms while backgrounded; keep socket if alive.
        this.clearReconnectTimer();
      }
    });
    this.ensureConnected();
  }

  stop(): void {
    this.intentionalClose = true;
    this.started = false;
    this.clearReconnectTimer();
    this.clearStableTimer();
    this.lifecycleUnsub?.();
    this.lifecycleUnsub = null;
    this.closeSocket();
    this.setState('idle');
  }

  /** Force reconnect after token refresh. */
  async reconnectWithFreshToken(): Promise<void> {
    this.intentionalClose = false;
    this.closeSocket();
    this.reconnectAttempt = 0;
    await this.connect();
  }

  markSeenEventId(eventId: string): boolean {
    if (this.seenEventIds.has(eventId)) {
      return false;
    }
    this.seenEventIds.add(eventId);
    this.seenEventQueue.push(eventId);
    while (this.seenEventQueue.length > REALTIME_CLIENT.maxRecentEventIds) {
      const old = this.seenEventQueue.shift();
      if (old) {
        this.seenEventIds.delete(old);
      }
    }
    return true;
  }

  hasSeenEventId(eventId: string): boolean {
    return this.seenEventIds.has(eventId);
  }

  /** Test helper */
  resetForTests(): void {
    this.stop();
    this.eventListeners.clear();
    this.stateListeners.clear();
    this.reconcileHandler = null;
    this.seenEventIds.clear();
    this.seenEventQueue = [];
    this.reconnectAttempt = 0;
    this.authRefreshInFlight = false;
  }

  private setState(next: RealtimeConnectionState): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    for (const listener of this.stateListeners) {
      try {
        listener(next);
      } catch {
        // never break bus
      }
    }
  }

  private ensureConnected(): void {
    if (this.intentionalClose) {
      return;
    }
    if (downloadAppLifecycle.getPhase() === 'background') {
      // Soft: do not aggressively reconnect in background.
      if (this.socket?.readyState === WebSocket.OPEN) {
        return;
      }
      return;
    }
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    void this.connect();
  }

  private async connect(): Promise<void> {
    if (this.intentionalClose) {
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      this.setState('auth_error');
      realtimeClientLog('ws.auth_failed', { reason: 'missing_token' }, 'warn');
      return;
    }

    this.setState(
      this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
    );
    if (this.reconnectAttempt > 0) {
      realtimeClientLog('ws.reconnect', { attempt: this.reconnectAttempt });
    }

    this.closeSocket();

    let url: string;
    let protocols: string[];
    try {
      const resolved = resolveWsConnection(token);
      url = resolved.url;
      protocols = resolved.protocols;
    } catch (error) {
      realtimeClientLog(
        'ws.connect',
        {
          ok: false,
          error: error instanceof Error ? error.message : 'url_failed',
        },
        'error',
      );
      this.scheduleReconnect();
      return;
    }

    try {
      const socket = new WebSocket(url, protocols);
      this.socket = socket;

      socket.onopen = () => {
        this.setState('connected');
        realtimeClientLog('ws.connect', { ok: true });
        this.armStableTimer();
        void this.runReconcile();
      };

      socket.onmessage = (message) => {
        this.handleMessage(message.data);
      };

      socket.onerror = () => {
        realtimeClientLog('ws.disconnect', { reason: 'error' }, 'warn');
      };

      socket.onclose = (event) => {
        this.socket = null;
        this.clearStableTimer();
        const code = event.code;
        realtimeClientLog('ws.disconnect', { code, reason: event.reason || undefined });

        if (this.intentionalClose) {
          this.setState('idle');
          return;
        }

        if (code === 4001 || code === 4002 || code === 4003 || code === 4004) {
          void this.handleAuthClose(code);
          return;
        }

        this.scheduleReconnect();
      };
    } catch (error) {
      realtimeClientLog(
        'ws.connect',
        {
          ok: false,
          error: error instanceof Error ? error.message : 'connect_failed',
        },
        'error',
      );
      this.scheduleReconnect();
    }
  }

  private async handleAuthClose(code: number): Promise<void> {
    if (this.authRefreshInFlight) {
      return;
    }
    this.authRefreshInFlight = true;
    try {
      await refreshSession();
      this.reconnectAttempt = 0;
      await this.connect();
    } catch {
      this.setState('auth_error');
      realtimeClientLog(
        'ws.auth_failed',
        { reason: 'refresh_failed', code },
        'warn',
      );
    } finally {
      this.authRefreshInFlight = false;
    }
  }

  private handleMessage(data: unknown): void {
    const event = parseDownloadRealtimeEvent(data);
    if (!event) {
      realtimeClientLog('ws.message_invalid', {}, 'warn');
      return;
    }

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // isolate listener failures
      }
    }
  }

  private async runReconcile(): Promise<void> {
    if (!this.reconcileHandler) {
      return;
    }
    try {
      await this.reconcileHandler();
      realtimeClientLog('reconciliation.success', {});
    } catch (error) {
      realtimeClientLog(
        'reconciliation.failure',
        {
          error: error instanceof Error ? error.message : 'reconcile_failed',
        },
        'warn',
      );
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) {
      return;
    }
    if (downloadAppLifecycle.getPhase() === 'background') {
      this.setState('offline');
      return;
    }

    this.clearReconnectTimer();
    const delay = jitteredBackoff(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private armStableTimer(): void {
    this.clearStableTimer();
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null;
      this.reconnectAttempt = 0;
    }, REALTIME_CLIENT.stableConnectionMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearStableTimer(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }

  private closeSocket(): void {
    if (!this.socket) {
      return;
    }
    const socket = this.socket;
    this.socket = null;
    try {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    } catch {
      // ignore
    }
  }
}

export const downloadRealtimeClient = new DownloadRealtimeClient();
