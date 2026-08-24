/**
 * Week 8 Day 3 Phase 3 — Offline Reconciliation & Sync Hardening (backend).
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week8-day3-phase3.ts
 */
import { createServer } from 'node:http';
import { DownloadStatus } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import * as downloadService from '../src/services/download.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';

const TAG = `w8d3p3-${Date.now()}`;
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
      name: `W8D3P3 ${suffix}`,
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
  console.log('\n=== Week 8 Day 3 Phase 3 — Backend Hardening ===\n');

  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('no address');
  }
  const baseUrl = `http://127.0.0.1:${addr.port}/api`;

  const userA = await createUser('a');
  const userB = await createUser('b');
  const createdA = await downloadService.createDownload(
    userA.user.id,
    mediaPayload('Phase3 Media A'),
  );
  const mediaA = await completeJob(userA.user.id, createdA.id);
  const createdB = await downloadService.createDownload(
    userB.user.id,
    mediaPayload('Phase3 Media B'),
  );
  const mediaB = await completeJob(userB.user.id, createdB.id);

  try {
    const putNew = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 140,
        durationSeconds: 600,
        updatedAt: new Date().toISOString(),
        lastPlayedAt: new Date().toISOString(),
        clientRevision: 6,
      },
    });
    check('put revision 6 accepted', putNew.status === 200);

    const putStale = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 120,
        durationSeconds: 600,
        updatedAt: new Date().toISOString(),
        clientRevision: 5,
      },
    });
    check(
      'stale revision 5 → 409',
      putStale.status === 409,
      `status=${putStale.status}`,
    );
    const conflictPlayback = (
      (putStale.body.data as { playback?: Record<string, unknown> } | undefined)
        ?.playback
    );
    check(
      '409 returns current playback',
      conflictPlayback?.clientRevision === 6 &&
        conflictPlayback?.positionSeconds === 140,
      JSON.stringify(conflictPlayback ?? putStale.body),
    );

    const putSame = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 140,
        durationSeconds: 600,
        clientRevision: 6,
      },
    });
    check('idempotent same revision accepted', putSame.status === 200);

    await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 600,
        durationSeconds: 600,
        markCompleted: true,
        clientRevision: 7,
      },
    });
    const unfinished = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 70,
        durationSeconds: 600,
        clientRevision: 8,
      },
    });
    const unfinishedPb = playbackOf(unfinished.body);
    check(
      'sticky completed cannot clear without replayReset',
      unfinished.status === 200 && unfinishedPb?.completed === true,
      JSON.stringify(unfinished.body),
    );

    const replay = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 5,
        durationSeconds: 600,
        replayReset: true,
        clientRevision: 9,
      },
    });
    const replayPb = playbackOf(replay.body);
    check(
      'replayReset clears completed',
      replay.status === 200 && replayPb?.completed === false,
      JSON.stringify(replay.body),
    );

    const skewed = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 20,
        durationSeconds: 600,
        lastPlayedAt: '2099-01-01T00:00:00.000Z',
        clientRevision: 10,
      },
    });
    check('future lastPlayedAt sanitized (200)', skewed.status === 200);

    const crossGet = await jsonFetch(baseUrl, `/playback/${mediaA.id}`, {
      token: userB.token,
    });
    const crossPut = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userB.token,
      body: { positionSeconds: 1, durationSeconds: 100, clientRevision: 1 },
    });
    const crossDel = await jsonFetch(baseUrl, `/playback/${mediaA.id}`, {
      method: 'DELETE',
      token: userB.token,
    });
    check('cross-user GET → 404', crossGet.status === 404);
    check('cross-user PUT → 404', crossPut.status === 404);
    check('cross-user DELETE → 404', crossDel.status === 404);

    const badPos = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: Number.NaN,
        durationSeconds: 100,
      },
    });
    check('NaN position rejected', badPos.status === 400 || badPos.status === 422);

    const overshoot = await jsonFetch(baseUrl, `/playback/${mediaA.id}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 5000,
        durationSeconds: 10,
        clientRevision: 11,
      },
    });
    check('impossible position rejected', overshoot.status === 400);

    await jsonFetch(baseUrl, `/playback/${mediaB.id}/progress`, {
      method: 'PUT',
      token: userB.token,
      body: {
        positionSeconds: 30,
        durationSeconds: 300,
        lastPlayedAt: new Date().toISOString(),
        clientRevision: 1,
      },
    });
    await prisma.downloadHistory.delete({ where: { id: mediaB.id } });
    const orphan = await prisma.playbackHistory.findUnique({
      where: {
        userId_mediaId: { userId: userB.user.id, mediaId: mediaB.id },
      },
    });
    check('DownloadHistory delete cascades PlaybackHistory', orphan === null);

    for (let i = 0; i < 40; i += 1) {
      const created = await downloadService.createDownload(
        userA.user.id,
        mediaPayload(`Bulk ${i}`),
      );
      const d = await completeJob(userA.user.id, created.id);
      await prisma.playbackHistory.upsert({
        where: {
          userId_mediaId: { userId: userA.user.id, mediaId: d.id },
        },
        create: {
          userId: userA.user.id,
          mediaId: d.id,
          positionSeconds: i,
          durationSeconds: 600,
          progressPercent: (i / 600) * 100,
          lastPlayedAt: new Date(Date.now() - i * 1000),
          completed: false,
          clientRevision: 1,
        },
        update: {
          positionSeconds: i,
          lastPlayedAt: new Date(Date.now() - i * 1000),
        },
      });
    }

    // Validator rejects absurd limits (400); capped parsePagination handles valid range.
    const historyHuge = await jsonFetch(
      baseUrl,
      '/playback/history?page=1&limit=1000000',
      { token: userA.token },
    );
    const historyOk = await jsonFetch(
      baseUrl,
      '/playback/history?page=1&limit=100',
      { token: userA.token },
    );
    const histData = historyOk.body.data as
      | { pagination?: { limit?: number }; items?: unknown[] }
      | undefined;
    const limit = histData?.pagination?.limit;
    const itemsLen = Array.isArray(histData?.items) ? histData.items.length : -1;
    check(
      'absurd limit rejected or capped',
      historyHuge.status === 400 ||
        (historyHuge.status === 200 &&
          ((histData?.pagination?.limit ?? 999) <= 100)),
      `hugeStatus=${historyHuge.status}`,
    );
    check(
      'pagination limit capped (≤100)',
      historyOk.status === 200 &&
        typeof limit === 'number' &&
        limit <= 100 &&
        itemsLen <= 100,
      `limit=${limit} items=${itemsLen}`,
    );

    const recent = await jsonFetch(baseUrl, '/playback/recent?limit=20', {
      token: userA.token,
    });
    check('recent query 200', recent.status === 200);

    const cw = await jsonFetch(
      baseUrl,
      '/playback/continue-watching?page=1&limit=20',
      { token: userA.token },
    );
    check('continue-watching 200', cw.status === 200);

    const countBefore = await prisma.playbackHistory.count({
      where: { userId: userA.user.id },
    });
    check(
      'user has sizable history for pagination',
      countBefore >= 40,
      `count=${countBefore}`,
    );
  } finally {
    await prisma.playbackHistory.deleteMany({
      where: {
        user: { email: { startsWith: `${TAG}-` } },
      },
    });
    await prisma.downloadHistory.deleteMany({
      where: {
        user: { email: { startsWith: `${TAG}-` } },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: `${TAG}-` } },
    });
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  const failed = results.filter((r) => !r.ok).length;
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nPhase 3 backend: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
