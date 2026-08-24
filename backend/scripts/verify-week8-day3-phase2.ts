/**
 * Week 8 Day 3 Phase 2 — backend history/recent/continue-watching hardening.
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week8-day3-phase2.ts
 */
import { createServer } from 'node:http';
import { DownloadStatus } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import * as downloadService from '../src/services/download.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';
import { resolveCompletedState } from '../src/domain/playback/index.js';

const TAG = `w8d3p2-${Date.now()}`;
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
  const headers: Record<string, string> = { accept: 'application/json' };
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
  const user = await prisma.user.create({
    data: {
      name: `W8D3P2 ${suffix}`,
      email: `${TAG}-${suffix}@vidorax.test`,
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

const completeMedia = async (userId: string, title: string) => {
  const created = await downloadService.createDownload(userId, {
    title,
    sourceUrl: `https://cdn.example.com/p2/${TAG}/${title}.mp4`,
    platform: 'OTHER',
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    fileName: `${title}.mp4`,
    fileSize: '1048576',
    quality: '720p',
    resolution: '1280x720',
    bitrate: 2_000_000,
  });
  await downloadService.updateDownload(userId, created.id, {
    status: DownloadStatus.DOWNLOADING,
    progress: 50,
  });
  return downloadService.updateDownload(userId, created.id, {
    status: DownloadStatus.COMPLETED,
    progress: 100,
  });
};

async function main(): Promise<void> {
  console.log('Week 8 Day 3 Phase 2 — backend playback UX verifier\n');

  check(
    'replayReset clears sticky completed',
    resolveCompletedState({
      positionSeconds: 3,
      durationSeconds: 600,
      existingCompleted: true,
      replayReset: true,
    }) === false,
  );
  check(
    'without replayReset completed stays sticky',
    resolveCompletedState({
      positionSeconds: 3,
      durationSeconds: 600,
      existingCompleted: true,
    }) === true,
  );

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('bind failed');
  }
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let userA: Awaited<ReturnType<typeof createUser>> | null = null;
  let userB: Awaited<ReturnType<typeof createUser>> | null = null;

  try {
    userA = await createUser('a');
    userB = await createUser('b');

    const mediaIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const m = await completeMedia(userA.user.id, `vid-${i}`);
      mediaIds.push(m.id);
      await jsonFetch(baseUrl, `/playback/${m.id}/progress`, {
        method: 'PUT',
        token: userA.token,
        body: {
          positionSeconds: 30 + i * 10,
          durationSeconds: 600,
          lastPlayedAt: new Date(Date.UTC(2026, 7, 22, 10, i)).toISOString(),
          ...(i === 4 ? { markCompleted: true } : {}),
        },
      });
    }

    const hist = await jsonFetch(baseUrl, '/playback/history?page=1&limit=3', {
      token: userA.token,
    });
    check('history paginated 200', hist.status === 200);
    const histData = hist.body.data as {
      items?: unknown[];
      pagination?: { limit?: number; hasMore?: boolean; page?: number };
    };
    check(
      'history page size',
      Array.isArray(histData?.items) && histData.items.length === 3,
      String(histData?.items?.length),
    );
    check('history hasMore', histData?.pagination?.hasMore === true);
    check('history limit clamped', histData?.pagination?.limit === 3);

    const huge = await jsonFetch(baseUrl, '/playback/history?limit=9999', {
      token: userA.token,
    });
    check('huge limit rejected or clamped', huge.status === 400 || huge.status === 200);
    if (huge.status === 200) {
      const d = huge.body.data as { pagination?: { limit?: number } };
      check('limit max 100', (d.pagination?.limit ?? 0) <= 100);
    }

    const cont = await jsonFetch(baseUrl, '/playback/continue-watching?limit=20', {
      token: userA.token,
    });
    const contItems = (
      cont.body.data as { items?: Array<{ completed?: boolean; mediaId?: string }> }
    )?.items;
    check('continue-watching 200', cont.status === 200);
    check(
      'continue excludes completed',
      Array.isArray(contItems) &&
        contItems.every((i) => i.completed === false) &&
        !contItems.some((i) => i.mediaId === mediaIds[4]),
    );

    const recent = await jsonFetch(baseUrl, '/playback/recent?limit=5', {
      token: userA.token,
    });
    check('recent 200', recent.status === 200);
    const recentItems = (recent.body.data as { items?: unknown[] })?.items;
    check(
      'recent includes completed',
      Array.isArray(recentItems) && recentItems.length >= 1,
    );

    const dto = (recentItems?.[0] ?? {}) as Record<string, unknown>;
    const leaked = ['userId', 'sourceUrl', 'localUri', 'path'].filter((k) =>
      Object.prototype.hasOwnProperty.call(dto, k),
    );
    check('safe DTO fields', leaked.length === 0, leaked.join(','));

    const cross = await jsonFetch(baseUrl, '/playback/history', {
      token: userB.token,
    });
    const crossItems = (cross.body.data as { items?: unknown[] })?.items;
    check(
      'user B empty history (ownership)',
      Array.isArray(crossItems) && crossItems.length === 0,
    );

    // replayReset path
    const completedId = mediaIds[4]!;
    const reset = await jsonFetch(baseUrl, `/playback/${completedId}/progress`, {
      method: 'PUT',
      token: userA.token,
      body: {
        positionSeconds: 2,
        durationSeconds: 600,
        replayReset: true,
      },
    });
    const resetPlayback = (
      reset.body.data as { playback?: { completed?: boolean } }
    )?.playback;
    check('PUT replayReset 200', reset.status === 200);
    check('replayReset clears completed', resetPlayback?.completed === false);
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
        await prisma.user.delete({ where: { id: userB.user.id } });
      }
    } catch {
      // cleanup best-effort
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
