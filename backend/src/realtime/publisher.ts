import type { WebSocket } from 'ws';
import type { DownloadRealtimeEvent, PublishDownloadEventInput } from './types.js';
import { REALTIME_CONSTANTS } from './types.js';
import { buildDownloadRealtimeEvent, isProgressOnlyEvent } from './event-mapper.js';
import { realtimeLog } from './diagnostics.js';

export type AuthenticatedSocket = WebSocket & {
  userId: string;
  isAlive: boolean;
  lastPongAt: number;
};

type SocketRegistry = Map<string, Set<AuthenticatedSocket>>;

interface ProgressSlot {
  event: DownloadRealtimeEvent;
  timer: ReturnType<typeof setTimeout> | null;
}

let registry: SocketRegistry = new Map();
let acceptingConnections = true;
/** Key: `${userId}:${downloadId}` */
const pendingProgress = new Map<string, ProgressSlot>();

function progressKey(userId: string, downloadId: string): string {
  return `${userId}:${downloadId}`;
}

function getUserSockets(userId: string): Set<AuthenticatedSocket> {
  let set = registry.get(userId);
  if (!set) {
    set = new Set();
    registry.set(userId, set);
  }
  return set;
}

export function isRealtimeAcceptingConnections(): boolean {
  return acceptingConnections;
}

export function setRealtimeAcceptingConnections(value: boolean): void {
  acceptingConnections = value;
}

export function bindSocketToUser(
  socket: AuthenticatedSocket,
  userId: string,
): void {
  socket.userId = userId;
  socket.isAlive = true;
  socket.lastPongAt = Date.now();
  getUserSockets(userId).add(socket);
  realtimeLog('ws.connect', { userId, sockets: getUserSockets(userId).size });
}

export function unbindSocket(socket: AuthenticatedSocket): void {
  const userId = socket.userId;
  if (!userId) {
    return;
  }
  const set = registry.get(userId);
  if (!set) {
    return;
  }
  set.delete(socket);
  if (set.size === 0) {
    registry.delete(userId);
  }
  realtimeLog('ws.disconnect', { userId, sockets: set.size });
}

function safeSend(
  socket: AuthenticatedSocket,
  event: DownloadRealtimeEvent,
): boolean {
  if (socket.readyState !== socket.OPEN) {
    return false;
  }

  const buffered = socket.bufferedAmount ?? 0;
  if (
    isProgressOnlyEvent(event.type) &&
    buffered > REALTIME_CONSTANTS.backpressureBytes
  ) {
    realtimeLog(
      'ws.backpressure',
      {
        userId: socket.userId,
        downloadId: event.downloadId,
        buffered,
        type: event.type,
      },
      'warn',
    );
    return false;
  }

  try {
    socket.send(JSON.stringify(event));
    return true;
  } catch (error) {
    realtimeLog(
      'ws.publish_error',
      {
        userId: socket.userId,
        downloadId: event.downloadId,
        type: event.type,
        error: error instanceof Error ? error.message : 'send_failed',
      },
      'error',
    );
    return false;
  }
}

function emitToUser(userId: string, event: DownloadRealtimeEvent): void {
  const sockets = registry.get(userId);
  if (!sockets || sockets.size === 0) {
    return;
  }

  for (const socket of sockets) {
    safeSend(socket, event);
  }
}

function clearPendingProgress(userId: string, downloadId: string): void {
  const key = progressKey(userId, downloadId);
  const slot = pendingProgress.get(key);
  if (!slot) {
    return;
  }
  if (slot.timer) {
    clearTimeout(slot.timer);
  }
  pendingProgress.delete(key);
}

function enqueueProgress(userId: string, event: DownloadRealtimeEvent): void {
  const key = progressKey(userId, event.downloadId);
  const existing = pendingProgress.get(key);
  if (existing) {
    existing.event = event;
    return;
  }

  const slot: ProgressSlot = { event, timer: null };
  slot.timer = setTimeout(() => {
    pendingProgress.delete(key);
    emitToUser(userId, slot.event);
  }, REALTIME_CONSTANTS.progressThrottleMs);
  pendingProgress.set(key, slot);
}

/**
 * Publish a typed download event to sockets bound to the owning user only.
 * Call only after durable backend state has been updated.
 */
export function publishDownloadEvent(
  input: PublishDownloadEventInput,
): DownloadRealtimeEvent {
  const event = buildDownloadRealtimeEvent(input);

  if (isProgressOnlyEvent(event.type)) {
    enqueueProgress(input.userId, event);
  } else {
    clearPendingProgress(input.userId, event.downloadId);
    emitToUser(input.userId, event);
  }

  return event;
}

export function closeAllRealtimeSockets(
  code = 1001,
  reason = 'shutting down',
): void {
  for (const sockets of registry.values()) {
    for (const socket of sockets) {
      try {
        socket.close(code, reason);
      } catch {
        // ignore
      }
    }
  }
  registry = new Map();
}

export function disposeRealtimePublisher(): void {
  for (const slot of pendingProgress.values()) {
    if (slot.timer) {
      clearTimeout(slot.timer);
    }
  }
  pendingProgress.clear();
}

/** Test helpers */
export function getRealtimeSocketCountForUser(userId: string): number {
  return registry.get(userId)?.size ?? 0;
}

export function resetRealtimePublisherForTests(): void {
  disposeRealtimePublisher();
  registry = new Map();
  acceptingConnections = true;
}
