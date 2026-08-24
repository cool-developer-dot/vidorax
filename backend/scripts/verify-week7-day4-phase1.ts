/**
 * Week 7 Day 4 Phase 1 — Realtime WebSocket sync verification (backend).
 * Ephemeral HTTP+WS server. Tagged test users cleaned up afterward.
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week7-day4-phase1.ts
 *
 * Query-token auth is disabled in production; enable for this verifier only.
 */
process.env.WS_ALLOW_QUERY_TOKEN = process.env.WS_ALLOW_QUERY_TOKEN ?? '1';
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_ENV = 'test';
}

import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken, generateRefreshToken } from '../src/security/jwt/index.js';
import { jwtConfig } from '../src/security/jwt/config.js';
import * as downloadService from '../src/services/download.service.js';
import {
  attachRealtimeGateway,
  buildDownloadRealtimeEvent,
  DOWNLOAD_EVENT_TYPES,
  ProgressEventThrottle,
  REALTIME_CONSTANTS,
  resetRealtimePublisherForTests,
  resolveDownloadEventType,
  shutdownRealtimeGateway,
  type DownloadRealtimeEvent,
} from '../src/realtime/index.js';
import { DownloadStatus, DownloadWorkerState } from '@prisma/client';

const TAG = `w7d4p1-${Date.now()}`;
const PASSWORD = 'TestPass123!';

type Check = { name: string; ok: boolean; detail?: string };
const results: Check[] = [];

const check = (name: string, ok: boolean, detail?: string): void => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function connectWs(
  port: number,
  token: string | null,
): Promise<{ ws: WebSocket; open: boolean; closeCode?: number }> {
  return new Promise((resolve) => {
    const url =
      token === null
        ? `ws://127.0.0.1:${port}${REALTIME_CONSTANTS.path}`
        : `ws://127.0.0.1:${port}${REALTIME_CONSTANTS.path}?access_token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    let settled = false;
    let opened = false;

    const done = (open: boolean, closeCode?: number) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ ws, open, closeCode });
    };

    ws.on('open', () => {
      opened = true;
      // Auth may close immediately after upgrade — wait briefly.
      setTimeout(() => {
        if (!settled && ws.readyState === WebSocket.OPEN) {
          done(true);
        }
      }, 80);
    });
    ws.on('unexpected-response', (_req, res) => {
      done(false, res.statusCode);
      ws.terminate();
    });
    ws.on('close', (code) => {
      if (opened && !settled) {
        done(false, code);
        return;
      }
      done(false, code);
    });
    ws.on('error', () => {
      // close handler will settle
    });
    setTimeout(() => {
      if (!settled) {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
        done(false);
      }
    }, 3_000);
  });
}

function attachCollector(ws: WebSocket): {
  events: DownloadRealtimeEvent[];
  stop: () => DownloadRealtimeEvent[];
} {
  const events: DownloadRealtimeEvent[] = [];
  const onMessage = (data: WebSocket.RawData) => {
    try {
      events.push(JSON.parse(String(data)) as DownloadRealtimeEvent);
    } catch {
      // ignore
    }
  };
  ws.on('message', onMessage);
  return {
    events,
    stop: () => {
      ws.off('message', onMessage);
      return events;
    },
  };
}

const createUser = async (suffix: string) => {
  const email = `${TAG}-${suffix}@vidorax.test`;
  const user = await prisma.user.create({
    data: {
      name: `D4P1 ${suffix}`,
      email,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
  const token = generateAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  return { user, token };
};

const media = (title: string) => ({
  title,
  sourceUrl: `https://cdn.example.com/media/${encodeURIComponent(title)}.mp4`,
  platform: 'OTHER',
  thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
  fileName: `${title.replace(/\s+/g, '_')}.mp4`,
  fileSize: '104857600',
});

async function main(): Promise<void> {
  console.log('Week 7 Day 4 Phase 1 — realtime WebSocket verifier\n');

  // ── Pure contract / mapper checks (no network) ───────────────────
  {
    check(
      'event contract has required types',
      DOWNLOAD_EVENT_TYPES.includes('download.progress') &&
        DOWNLOAD_EVENT_TYPES.includes('download.completed') &&
        DOWNLOAD_EVENT_TYPES.includes('download.failed'),
    );

    const now = new Date();
    const item = {
      id: 'd1',
      userId: 'u1',
      title: 't',
      sourceUrl: 'https://cdn.example.com/x.mp4?sig=SECRET',
      platform: 'OTHER',
      thumbnailUrl: 'https://cdn.example.com/t.jpg',
      fileName: 'x.mp4',
      fileSize: '1000',
      status: DownloadStatus.DOWNLOADING,
      progress: 40,
      quality: '720p',
      resolution: '1280x720',
      bitrate: 1_000_000,
      retryCount: 0,
      workerState: DownloadWorkerState.TRANSFERRING,
      errorCode: null,
      errorMessage: null,
      downloadedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const event = buildDownloadRealtimeEvent({
      userId: 'u1',
      item,
      previous: {
        status: DownloadStatus.DOWNLOADING,
        progress: 20,
        workerState: DownloadWorkerState.TRANSFERRING,
      },
    });

    check('progress event type', event.type === 'download.progress');
    check('payload has eventId', typeof event.eventId === 'string' && event.eventId.length > 0);
    check('payload has version', event.version === now.getTime());
    check('no sourceUrl in event', !('sourceUrl' in event));
    check('no authorization fields', !('token' in event) && !('authorization' in event));
    check('omits retryCount when zero', event.retryCount === undefined);
    check(
      'started mapping',
      resolveDownloadEventType(
        { ...item, status: DownloadStatus.DOWNLOADING },
        {
          status: DownloadStatus.QUEUED,
          progress: 0,
          workerState: DownloadWorkerState.WAITING,
        },
      ) === 'download.started',
    );
    check(
      'paused mapping',
      resolveDownloadEventType(
        { ...item, status: DownloadStatus.PAUSED, workerState: DownloadWorkerState.PAUSED },
        {
          status: DownloadStatus.DOWNLOADING,
          progress: 40,
          workerState: DownloadWorkerState.TRANSFERRING,
        },
      ) === 'download.paused',
    );
    check(
      'completed mapping',
      resolveDownloadEventType(
        {
          ...item,
          status: DownloadStatus.COMPLETED,
          progress: 100,
          workerState: DownloadWorkerState.COMPLETED,
        },
        {
          status: DownloadStatus.DOWNLOADING,
          progress: 99,
          workerState: DownloadWorkerState.TRANSFERRING,
        },
      ) === 'download.completed',
    );

    // Throttle: many progress → one flush window; terminal bypasses
    let flushed = 0;
    const throttle = new ProgressEventThrottle(() => {
      flushed += 1;
    }, 200);
    for (let i = 0; i < 20; i += 1) {
      throttle.enqueue({
        ...event,
        eventId: `e${i}`,
        progress: i,
        type: 'download.progress',
      });
    }
    check('progress coalesced pending', flushed === 0);
    await wait(250);
    check('progress flushed once', flushed === 1);
    throttle.enqueue({
      ...event,
      type: 'download.completed',
      status: DownloadStatus.COMPLETED,
      progress: 100,
      eventId: 'done',
    });
    check('terminal bypasses throttle', flushed === 2);
    throttle.dispose();
  }

  resetRealtimePublisherForTests();
  const server = createServer(app);
  attachRealtimeGateway(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('bind failed');
  }
  const port = address.port;

  let userA: Awaited<ReturnType<typeof createUser>> | null = null;
  let userB: Awaited<ReturnType<typeof createUser>> | null = null;
  const createdIds: string[] = [];

  try {
    userA = await createUser('a');
    userB = await createUser('b');

    // ── Auth ────────────────────────────────────────────────────────
    {
      const missing = await connectWs(port, null);
      check(
        'auth missing token rejected',
        !missing.open &&
          (missing.closeCode === 4001 || missing.closeCode === 1008),
      );
      try {
        missing.ws.terminate();
      } catch {
        // ignore
      }

      const invalid = await connectWs(port, 'not-a-jwt');
      check(
        'auth invalid token rejected',
        !invalid.open &&
          (invalid.closeCode === 4002 ||
            invalid.closeCode === 1008 ||
            invalid.closeCode === undefined),
      );
      try {
        invalid.ws.terminate();
      } catch {
        // ignore
      }

      const expired = jwt.sign(
        {
          sub: userA.user.id,
          email: userA.user.email,
          role: userA.user.role,
          type: 'access',
          exp: Math.floor(Date.now() / 1000) - 60,
        },
        jwtConfig.accessSecret,
        { algorithm: 'HS256' },
      );
      const expiredConn = await connectWs(port, expired);
      check(
        'auth expired token rejected',
        !expiredConn.open &&
          (expiredConn.closeCode === 4003 ||
            expiredConn.closeCode === 4002 ||
            expiredConn.closeCode === 1008),
      );
      try {
        expiredConn.ws.terminate();
      } catch {
        // ignore
      }

      const refresh = generateRefreshToken({
        sub: userA.user.id,
        email: userA.user.email,
        role: userA.user.role,
      });
      const wrongType = await connectWs(port, refresh);
      check(
        'auth refresh token rejected',
        !wrongType.open,
      );
      try {
        wrongType.ws.terminate();
      } catch {
        // ignore
      }

      const valid = await connectWs(port, userA.token);
      check('auth valid token accepted', valid.open);
      try {
        valid.ws.terminate();
      } catch {
        // ignore
      }
    }

    // ── Isolation + event fan-out ───────────────────────────────────
    {
      const a = await connectWs(port, userA.token);
      const b = await connectWs(port, userB.token);
      check('user A connected', a.open);
      check('user B connected', b.open);

      const aCollector = attachCollector(a.ws);
      const bCollector = attachCollector(b.ws);

      const created = await downloadService.createDownload(
        userA.user.id,
        media('Iso Test'),
      );
      createdIds.push(created.id);

      await downloadService.updateDownload(userA.user.id, created.id, {
        status: DownloadStatus.DOWNLOADING,
        workerState: DownloadWorkerState.TRANSFERRING,
      });
      await downloadService.updateDownload(userA.user.id, created.id, {
        progress: 55,
      });
      await downloadService.updateDownload(userA.user.id, created.id, {
        status: DownloadStatus.PAUSED,
        workerState: DownloadWorkerState.PAUSED,
      });
      await downloadService.updateDownload(userA.user.id, created.id, {
        status: DownloadStatus.DOWNLOADING,
        workerState: DownloadWorkerState.TRANSFERRING,
      });
      await downloadService.updateDownload(userA.user.id, created.id, {
        status: DownloadStatus.FAILED,
        errorCode: 'NETWORK',
        errorMessage: 'timeout',
        workerState: DownloadWorkerState.FAILED,
      });
      await downloadService.updateDownload(userA.user.id, created.id, {
        status: DownloadStatus.QUEUED,
        errorCode: null,
        errorMessage: null,
        workerState: DownloadWorkerState.WAITING,
      });
      await downloadService.updateDownload(userA.user.id, created.id, {
        status: DownloadStatus.DOWNLOADING,
        workerState: DownloadWorkerState.TRANSFERRING,
        progress: 90,
      });
      await downloadService.updateDownload(userA.user.id, created.id, {
        status: DownloadStatus.COMPLETED,
        progress: 100,
        workerState: DownloadWorkerState.COMPLETED,
      });

      // Flush any coalesced progress
      await wait(900);

      const aEvents = aCollector.stop();
      const bEvents = bCollector.stop();

      const types = new Set(aEvents.map((e) => e.type));
      check('received queued', types.has('download.queued'));
      check('received started', types.has('download.started'));
      check('received paused', types.has('download.paused'));
      check('received resumed', types.has('download.resumed'));
      check('received failed', types.has('download.failed'));
      check('received retrying', types.has('download.retrying'));
      check('received completed', types.has('download.completed'));
      check(
        'user B received zero A events',
        bEvents.length === 0,
        `got ${bEvents.length}`,
      );
      check(
        'events scoped to download id',
        aEvents.every((e) => e.downloadId === created.id),
      );
      check(
        'no sensitive fields in payloads',
        aEvents.every(
          (e) =>
            !('sourceUrl' in e) &&
            !('token' in e) &&
            !('authorization' in e) &&
            !JSON.stringify(e).includes('SECRET'),
        ),
      );

      // Cancel path on a second job
      const job2 = await downloadService.createDownload(
        userA.user.id,
        media('Cancel Me'),
      );
      createdIds.push(job2.id);
      const cancelCollector = attachCollector(a.ws);
      await downloadService.updateDownload(userA.user.id, job2.id, {
        status: DownloadStatus.CANCELLED,
        workerState: DownloadWorkerState.CANCELLED,
      });
      await wait(100);
      const cancelEvents = cancelCollector.stop();
      check(
        'received cancelled',
        cancelEvents.some((e) => e.type === 'download.cancelled'),
      );

      try {
        a.ws.terminate();
        b.ws.terminate();
      } catch {
        // ignore
      }
    }

    // ── Progress throttle under burst ───────────────────────────────
    {
      const a = await connectWs(port, userA.token);
      check('throttle test connected', a.open);
      const job = await downloadService.createDownload(
        userA.user.id,
        media('Throttle'),
      );
      createdIds.push(job.id);
      const started = await downloadService.updateDownload(userA.user.id, job.id, {
        status: DownloadStatus.DOWNLOADING,
        workerState: DownloadWorkerState.TRANSFERRING,
      });

      const collector = attachCollector(a.ws);
      // Burst publish without waiting on DB — mirrors many in-process emits.
      const { publishDownloadEvent } = await import('../src/realtime/index.js');
      for (let p = 1; p <= 20; p += 1) {
        publishDownloadEvent({
          userId: userA.user.id,
          item: {
            ...started,
            progress: p,
            updatedAt: new Date(started.updatedAt.getTime() + p),
          },
          previous: {
            status: DownloadStatus.DOWNLOADING,
            progress: p - 1,
            workerState: DownloadWorkerState.TRANSFERRING,
          },
        });
      }
      await wait(900);
      const events = collector.stop();
      const progressEvents = events.filter((e) => e.type === 'download.progress');
      check(
        'progress WS emits bounded',
        progressEvents.length <= 3 && progressEvents.length >= 1,
        `got ${progressEvents.length}`,
      );

      const terminalCollector = attachCollector(a.ws);
      await downloadService.updateDownload(userA.user.id, job.id, {
        status: DownloadStatus.COMPLETED,
        progress: 100,
      });
      await wait(100);
      const terminal = terminalCollector.stop();
      check(
        'terminal completes after burst',
        terminal.some((e) => e.type === 'download.completed'),
      );
      try {
        a.ws.terminate();
      } catch {
        // ignore
      }
    }
  } finally {
    if (createdIds.length > 0) {
      await prisma.downloadHistory.deleteMany({
        where: { id: { in: createdIds } },
      });
    }
    if (userA || userB) {
      await prisma.user.deleteMany({
        where: { email: { contains: TAG } },
      });
    }

    shutdownRealtimeGateway();
    resetRealtimePublisherForTests();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error);
  try {
    shutdownRealtimeGateway();
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
