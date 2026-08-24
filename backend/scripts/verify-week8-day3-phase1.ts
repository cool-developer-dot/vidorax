/**
 * Week 8 Day 3 Phase 1 — Durable Playback State Core (backend).
 * Ephemeral HTTP server. Tagged test users cleaned up afterward.
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week8-day3-phase1.ts
 */
import { createServer } from 'node:http';
import { DownloadStatus } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import {
  computeProgressPercent,
  isNearEndComplete,
  resolveCompletedState,
} from '../src/domain/playback/index.js';
import * as downloadService from '../src/services/download.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';

const TAG = `w8d3p1-${Date.now()}`;
const PASSWORD = 'TestPass123!';

type CheckResult = { name: string; ok: boolean; detail?: string };
const results: CheckResult[] = [];

const check = (name: string, ok: boolean, detail?: string): void => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const jsonFetch = async (
  baseUrl: string,
  path: string,
  init: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {},
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (init.token) {
    headers.authorization = `Bearer ${init.token}`;
  }
  if (init.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { status: response.status, body };
};

const createUser = async (suffix: string) => {
  const email = `${TAG}-${suffix}@vidorax.test`;
  const user = await prisma.user.create({
    data: {
      name: `W8D3 ${suffix}`,
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

const mediaPayload = (title: string) => ({
  title,
  sourceUrl: `https://cdn.example.com/playback/${TAG}/${encodeURIComponent(title)}.mp4`,
  platform: 'OTHER',
  thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
  fileName: `${title.replace(/\s+/g, '_')}.mp4`,
  fileSize: '104857600',
  quality: '1080p',
  resolution: '1920x1080',
  bitrate: 5_000_000,
});

const completeJob = async (userId: string, id: string) => {
  await downloadService.updateDownload(userId, id, {
    status: DownloadStatus.DOWNLOADING,
    progress: 50,
  });
  return downloadService.updateDownload(userId, id, {
    status: DownloadStatus.COMPLETED,
    progress: 100,
  });
};

function playbackOf(body: Record<string, unknown>): Record<string, unknown> | null {
  const data = body.data as Record<string, unknown> | undefined;
  if (!data) {
    return null;
  }
  if (data.playback && typeof data.playback === 'object') {
    return data.playback as Record<string, unknown>;
  }
  return null;
}

async function main(): Promise<void> {
  console.log('Week 8 Day 3 Phase 1 — backend playback verifier\n');

  // Domain unit checks (no DB)
  check('domain progress 0 duration', computeProgressPercent(5, 0) === 0);
  check('domain progress clamp', computeProgressPercent(150, 100) === 100);
  check(
    'domain near-end 95%',
    isNearEndComplete({ positionSeconds: 95, durationSeconds: 100 }),
  );
  check(
    'domain short video guard',
    !isNearEndComplete({ positionSeconds: 15, durationSeconds: 20 }),
  );
  check(
    'domain completed sticky',
    resolveCompletedState({
      positionSeconds: 1,
      durationSeconds: 100,
      existingCompleted: true,
    }) === true,
  );

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind ephemeral server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let userA: Awaited<ReturnType<typeof createUser>> | null = null;
  let userB: Awaited<ReturnType<typeof createUser>> | null = null;
  let mediaAId = '';
  let mediaBId = '';

  try {
    userA = await createUser('a');
    userB = await createUser('b');

    const createdA = await downloadService.createDownload(
      userA.user.id,
      mediaPayload('Play A'),
    );
    const completedA = await completeJob(userA.user.id, createdA.id);
    mediaAId = completedA.id;

    const createdB = await downloadService.createDownload(
      userB.user.id,
      mediaPayload('Play B'),
    );
    const completedB = await completeJob(userB.user.id, createdB.id);
    mediaBId = completedB.id;

    // First PUT → insert
    const put1 = await jsonFetch(baseUrl, `/playback/${mediaAId}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 100,
        durationSeconds: 1000,
        updatedAt: new Date().toISOString(),
        lastPlayedAt: new Date().toISOString(),
      },
    });
    check('PUT progress 200', put1.status === 200, String(put1.status));
    const p1 = playbackOf(put1.body);
    check('PUT returns mediaId', p1?.mediaId === mediaAId);
    check(
      'PUT derives progressPercent',
      p1?.progressPercent === 10,
      String(p1?.progressPercent),
    );
    check('PUT has no userId leak', p1 != null && !('userId' in p1));

    const rowCount1 = await prisma.playbackHistory.count({
      where: { userId: userA.user.id, mediaId: mediaAId },
    });
    check('first row created', rowCount1 === 1);

    // Repeated PUT → same row
    for (let i = 0; i < 9; i += 1) {
      await jsonFetch(baseUrl, `/playback/${mediaAId}/progress`, {
        method: 'PUT',
        token: userA.token,
        body: {
          positionSeconds: 110 + i * 10,
          durationSeconds: 1000,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    const rowCount10 = await prisma.playbackHistory.count({
      where: { userId: userA.user.id, mediaId: mediaAId },
    });
    check('10 updates → 1 row', rowCount10 === 1);

    const get1 = await jsonFetch(baseUrl, `/playback/${mediaAId}`, {
      token: userA.token,
    });
    check('GET playback 200', get1.status === 200);
    const g1 = playbackOf(get1.body);
    check(
      'GET latest position',
      typeof g1?.positionSeconds === 'number' &&
        (g1.positionSeconds as number) >= 180,
      String(g1?.positionSeconds),
    );

    // Cross-user 404
    const crossGet = await jsonFetch(baseUrl, `/playback/${mediaAId}`, {
      token: userB.token,
    });
    check('cross-user GET 404', crossGet.status === 404, String(crossGet.status));

    const crossPut = await jsonFetch(baseUrl, `/playback/${mediaAId}/progress`, {
      method: 'PUT',
      token: userB.token,
      body: { positionSeconds: 1, durationSeconds: 10 },
    });
    check('cross-user PUT 404', crossPut.status === 404, String(crossPut.status));

    // Invalid mediaId
    const badId = await jsonFetch(
      baseUrl,
      '/playback/not-a-uuid/progress',
      {
        method: 'PUT',
        token: userA.token,
        body: { positionSeconds: 1, durationSeconds: 10 },
      },
    );
    check('invalid mediaId rejected', badId.status === 400 || badId.status === 422, String(badId.status));

    // Invalid position / duration
    const neg = await jsonFetch(baseUrl, `/playback/${mediaAId}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: { positionSeconds: -1, durationSeconds: 10 },
    });
    check('negative position rejected', neg.status === 400, String(neg.status));

    const far = await jsonFetch(baseUrl, `/playback/${mediaAId}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: { positionSeconds: 500, durationSeconds: 10 },
    });
    check('position far beyond duration rejected', far.status === 400, String(far.status));

    const rejectPercent = await jsonFetch(
      baseUrl,
      `/playback/${mediaAId}/progress`,
      {
        method: 'PUT',
        token: userA.token,
        body: {
          positionSeconds: 1,
          durationSeconds: 10,
          progressPercent: 99,
        },
      },
    );
    check(
      'client progressPercent rejected',
      rejectPercent.status === 400,
      String(rejectPercent.status),
    );

    // markCompleted
    const done = await jsonFetch(baseUrl, `/playback/${mediaAId}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 1000,
        durationSeconds: 1000,
        markCompleted: true,
      },
    });
    const doneP = playbackOf(done.body);
    check('markCompleted → completed', doneP?.completed === true);

    // Sticky completed
    const sticky = await jsonFetch(baseUrl, `/playback/${mediaAId}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: { positionSeconds: 10, durationSeconds: 1000 },
    });
    check(
      'completed not downgraded',
      playbackOf(sticky.body)?.completed === true,
    );

    // Seed continue-watching (incomplete) for user B
    await jsonFetch(baseUrl, `/playback/${mediaBId}/progress`, {
      method: 'PUT',
      token: userB.token,
      body: {
        positionSeconds: 50,
        durationSeconds: 500,
        lastPlayedAt: new Date().toISOString(),
      },
    });

    const historyA = await jsonFetch(baseUrl, '/playback/history?limit=10', {
      token: userA.token,
    });
    check('history 200', historyA.status === 200);
    const histData = historyA.body.data as { items?: unknown[] } | undefined;
    check(
      'history ordered items',
      Array.isArray(histData?.items) && (histData?.items.length ?? 0) >= 1,
    );

    const contB = await jsonFetch(
      baseUrl,
      '/playback/continue-watching?limit=10',
      { token: userB.token },
    );
    const contData = contB.body.data as { items?: Array<{ completed?: boolean }> } | undefined;
    check('continue-watching 200', contB.status === 200);
    check(
      'continue-watching completed=false',
      Array.isArray(contData?.items) &&
        (contData?.items.length ?? 0) >= 1 &&
        contData!.items.every((i) => i.completed === false),
    );

    const recentA = await jsonFetch(baseUrl, '/playback/recent?limit=5', {
      token: userA.token,
    });
    check('recent 200', recentA.status === 200);
    const recentData = recentA.body.data as { items?: unknown[] } | undefined;
    check(
      'recent has items',
      Array.isArray(recentData?.items) && (recentData?.items.length ?? 0) >= 1,
    );

    // Delete history only
    const del = await jsonFetch(baseUrl, `/playback/${mediaAId}`, {
      method: 'DELETE',
      token: userA.token,
    });
    check('DELETE history 200', del.status === 200);
    const stillMedia = await prisma.downloadHistory.findUnique({
      where: { id: mediaAId },
    });
    check('DELETE does not remove DownloadHistory', stillMedia != null);
    const gone = await prisma.playbackHistory.count({
      where: { userId: userA.user.id, mediaId: mediaAId },
    });
    check('DELETE removes PlaybackHistory row', gone === 0);

    // Cascade: delete media → playback gone
    await jsonFetch(baseUrl, `/playback/${mediaBId}/progress`, {
      method: 'PUT',
      token: userB.token,
      body: {
        positionSeconds: 20,
        durationSeconds: 200,
        lastPlayedAt: new Date().toISOString(),
      },
    });
    await downloadService.deleteDownload(userB.user.id, mediaBId);
    const cascaded = await prisma.playbackHistory.count({
      where: { mediaId: mediaBId },
    });
    check('media delete cascades PlaybackHistory', cascaded === 0);

    // Unique + indexes exist
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'PlaybackHistory'
    `;
    const names = indexes.map((r) => r.indexname);
    check(
      'unique(userId, mediaId) index',
      names.some((n) => n.includes('userId_mediaId')),
      names.join(','),
    );
    check(
      'userId_lastPlayedAt index',
      names.some((n) => n.includes('userId_lastPlayedAt')),
    );
    check(
      'userId_completed index',
      names.some((n) => n.includes('userId_completed')),
    );
  } catch (error) {
    check(
      'verifier crashed',
      false,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    try {
      if (userA) {
        await prisma.playbackHistory.deleteMany({
          where: { userId: userA.user.id },
        });
        await prisma.downloadHistory.deleteMany({
          where: { userId: userA.user.id },
        });
        await prisma.user.delete({ where: { id: userA.user.id } });
      }
      if (userB) {
        await prisma.playbackHistory.deleteMany({
          where: { userId: userB.user.id },
        });
        await prisma.downloadHistory.deleteMany({
          where: { userId: userB.user.id },
        });
        await prisma.user.delete({ where: { id: userB.user.id } });
      }
    } catch {
      // best-effort cleanup
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
