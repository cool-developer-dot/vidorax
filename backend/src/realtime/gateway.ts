import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../security/jwt/index.js';
import {
  bindSocketToUser,
  closeAllRealtimeSockets,
  disposeRealtimePublisher,
  isRealtimeAcceptingConnections,
  setRealtimeAcceptingConnections,
  unbindSocket,
  type AuthenticatedSocket,
} from './publisher.js';
import { REALTIME_CONSTANTS, WS_CLOSE } from './types.js';
import { realtimeLog } from './diagnostics.js';

const { TokenExpiredError, JsonWebTokenError } = jwt;

let wss: WebSocketServer | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function extractToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  // Prefer Sec-WebSocket-Protocol (`bearer, <jwt>`) over query tokens.
  const protocol = req.headers['sec-websocket-protocol'];
  if (typeof protocol === 'string') {
    const parts = protocol.split(',').map((p) => p.trim());
    const bearerIdx = parts.findIndex((p) => p.toLowerCase() === 'bearer');
    if (bearerIdx >= 0 && parts[bearerIdx + 1]) {
      return parts[bearerIdx + 1];
    }
  }

  // Query-token fallback: disabled in production (tokens leak via proxy logs).
  // Tests may set WS_ALLOW_QUERY_TOKEN=1. Mobile production uses Sec-WebSocket-Protocol.
  const allowQueryToken =
    process.env.NODE_ENV !== 'production' ||
    process.env.WS_ALLOW_QUERY_TOKEN === '1';
  if (allowQueryToken) {
    try {
      const host = req.headers.host ?? 'localhost';
      const url = new URL(req.url ?? '/', `http://${host}`);
      const fromQuery =
        url.searchParams.get('access_token') ?? url.searchParams.get('token');
      if (fromQuery && fromQuery.trim()) {
        return fromQuery.trim();
      }
    } catch {
      // ignore malformed URL
    }
  }

  return null;
}

function closeAuthFailure(
  socket: WebSocket,
  code: number,
  reason: string,
  detail: string,
): void {
  realtimeLog('ws.auth_failed', { reason: detail, code }, 'warn');
  try {
    socket.close(code, reason);
  } catch {
    try {
      socket.terminate();
    } catch {
      // ignore
    }
  }
}

function authenticateUpgrade(
  socket: WebSocket,
  req: IncomingMessage,
): AuthenticatedSocket | null {
  const token = extractToken(req);
  if (!token) {
    closeAuthFailure(
      socket,
      WS_CLOSE.MISSING_TOKEN,
      'token required',
      'missing_token',
    );
    return null;
  }

  try {
    const payload = verifyAccessToken(token);
    const authed = socket as AuthenticatedSocket;
    bindSocketToUser(authed, payload.sub);
    return authed;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      closeAuthFailure(
        socket,
        WS_CLOSE.EXPIRED_TOKEN,
        'token expired',
        'expired_token',
      );
      return null;
    }
    if (error instanceof JsonWebTokenError) {
      const message = error.message.toLowerCase();
      if (message.includes('jwt malformed') || message.includes('invalid')) {
        closeAuthFailure(
          socket,
          WS_CLOSE.INVALID_TOKEN,
          'invalid token',
          'invalid_token',
        );
        return null;
      }
    }
    if (error instanceof Error && error.message === 'Invalid access token') {
      closeAuthFailure(
        socket,
        WS_CLOSE.WRONG_TOKEN_TYPE,
        'wrong token type',
        'wrong_token_type',
      );
      return null;
    }
    closeAuthFailure(
      socket,
      WS_CLOSE.INVALID_TOKEN,
      'invalid token',
      'auth_failed',
    );
    return null;
  }
}

function startHeartbeat(server: WebSocketServer): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const client of server.clients) {
      const socket = client as AuthenticatedSocket;
      if (!socket.userId) {
        continue;
      }
      if (
        !socket.isAlive ||
        now - socket.lastPongAt > REALTIME_CONSTANTS.heartbeatTimeoutMs
      ) {
        realtimeLog('ws.disconnect', {
          userId: socket.userId,
          reason: 'heartbeat_timeout',
        });
        unbindSocket(socket);
        try {
          socket.terminate();
        } catch {
          // ignore
        }
        continue;
      }
      socket.isAlive = false;
      try {
        socket.ping();
      } catch {
        unbindSocket(socket);
        try {
          socket.terminate();
        } catch {
          // ignore
        }
      }
    }
  }, REALTIME_CONSTANTS.heartbeatIntervalMs);

  // Allow process to exit without waiting on heartbeat in tests.
  if (typeof heartbeatTimer.unref === 'function') {
    heartbeatTimer.unref();
  }
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Attach authenticated download WebSocket gateway to the existing HTTP server.
 * Path: /ws/downloads
 */
export function attachRealtimeGateway(server: HttpServer): WebSocketServer {
  if (wss) {
    return wss;
  }

  setRealtimeAcceptingConnections(true);

  wss = new WebSocketServer({
    server,
    path: REALTIME_CONSTANTS.path,
    maxPayload: 64 * 1024,
    perMessageDeflate: false,
    handleProtocols: (protocols) => {
      const list = [...protocols];
      const bearerIdx = list.findIndex((p) => p.toLowerCase() === 'bearer');
      if (bearerIdx >= 0 && list[bearerIdx + 1]) {
        return 'bearer';
      }
      // No protocol negotiated (query/header auth clients).
      return false;
    },
  });

  wss.on('connection', (socket, req) => {
    if (!isRealtimeAcceptingConnections()) {
      closeAuthFailure(
        socket,
        WS_CLOSE.SHUTTING_DOWN,
        'shutting down',
        'shutting_down',
      );
      return;
    }

    const authed = authenticateUpgrade(socket, req);
    if (!authed) {
      return;
    }

    authed.on('pong', () => {
      authed.isAlive = true;
      authed.lastPongAt = Date.now();
    });

    // Clients must not subscribe to arbitrary rooms — ignore inbound commands.
    authed.on('message', () => {
      // Intentionally no-op: server pushes events; no client room control.
    });

    authed.on('close', () => {
      unbindSocket(authed);
    });

    authed.on('error', () => {
      unbindSocket(authed);
    });
  });

  startHeartbeat(wss);
  return wss;
}

export function shutdownRealtimeGateway(): void {
  setRealtimeAcceptingConnections(false);
  stopHeartbeat();
  disposeRealtimePublisher();
  closeAllRealtimeSockets(WS_CLOSE.GOING_AWAY, 'server shutdown');
  if (wss) {
    try {
      wss.close();
    } catch {
      // ignore
    }
    wss = null;
  }
}

export function getRealtimeGatewayForTests(): WebSocketServer | null {
  return wss;
}
