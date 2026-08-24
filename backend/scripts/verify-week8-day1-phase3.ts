/**
 * Week 8 Day 1 Phase 3 — Production file metadata rename/delete verifier (backend).
 *
 * Ephemeral HTTP server. Tagged test users cleaned up afterward.
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week8-day1-phase3.ts
 */
import { createServer } from 'node:http';
import { DownloadStatus, FavoritePlatform } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import * as downloadService from '../src/services/download.service.js';
import * as favoriteService from '../src/services/favorite.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';

const TAG_PREFIX = 'w8d1p3-';
const TAG = `${TAG_PREFIX}${Date.now()}`;
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
  const email = `${TAG}-${suffix}@vidorax.test`;
  const user = await prisma.user.create({
    data: {
      name: `W8D1P3 ${suffix}`,
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
  sourceUrl: `https://cdn.example.com/media/${encodeURIComponent(title)}.mp4`,
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

async function main(): Promise<void> {
  console.log('Week 8 Day 1 Phase 3 — metadata rename/delete verifier (backend)\n');

  // Prevent collisions from prior failed runs.
  await prisma.user
    .deleteMany({
      where: { email: { startsWith: TAG_PREFIX } },
    })
    .catch(() => undefined);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind ephemeral server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let userA: Awaited<ReturnType<typeof createUser>> | null = null;
  let userB: Awaited<ReturnType<typeof createUser>> | null = null;

  try {
    userA = await createUser('a');
    userB = await createUser('b');

    const completed = await downloadService.createDownload(
      userA.user.id,
      mediaPayload(`${TAG} media1`),
    );
    await completeJob(userA.user.id, completed.id);

    // Seed a favorite so delete can clean up favorites by sourceUrl.
    await favoriteService.createFavorite(userA.user.id, {
      title: `${TAG} media1`,
      platform: FavoritePlatform.OTHER,
      sourceUrl: completed.sourceUrl,
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    });

    // Rename happy path.
    const rename1 = await jsonFetch(
      baseUrl,
      `/media/${completed.id}/rename`,
      {
        method: 'PATCH',
        token: userA.token,
        body: { displayName: `${TAG} renamed.mp4` },
      },
    );
    check('rename returns 200', rename1.status === 200);
    const renamed = rename1.body.data as { id?: string; fileName?: string; title?: string };
    check('rename returns media payload', Boolean(renamed?.id));
    check(
      'rename preserves extension',
      String(renamed?.fileName ?? '').endsWith('.mp4'),
    );

    // Rename should reject extension manipulation.
    const renameBad = await jsonFetch(
      baseUrl,
      `/media/${completed.id}/rename`,
      {
        method: 'PATCH',
        token: userA.token,
        body: { displayName: `${TAG} renamed.avi` },
      },
    );
    check('rename rejects extension change', renameBad.status === 400);

    // Cross-user rename rejected.
    const renameCross = await jsonFetch(
      baseUrl,
      `/media/${completed.id}/rename`,
      {
        method: 'PATCH',
        token: userB.token,
        body: { displayName: `${TAG} x.mp4` },
      },
    );
    check('cross-user rename rejected', renameCross.status === 404);

    // Delete happy path + idempotency.
    const del1 = await jsonFetch(baseUrl, `/media/${completed.id}`, {
      method: 'DELETE',
      token: userA.token,
    });
    check('delete returns 200', del1.status === 200);

    const del2 = await jsonFetch(baseUrl, `/media/${completed.id}`, {
      method: 'DELETE',
      token: userA.token,
    });
    check('delete is idempotent (second delete ok)', del2.status === 200);

    // Media removed from library.
    const lib = await jsonFetch(baseUrl, `/media/library?limit=20`, {
      token: userA.token,
    });
    const items = ((lib.body.data as { items?: unknown[] })?.items ?? []) as any[];
    check('deleted media not in library', items.every((x) => x.id !== completed.id));

    // Favorites cleaned up.
    const favOnly = await jsonFetch(baseUrl, `/media/library?favorite=true&limit=20`, {
      token: userA.token,
    });
    const favItems = ((favOnly.body.data as { items?: unknown[] })?.items ?? []) as any[];
    check('favorite removed after delete', favItems.every((x) => x.id !== completed.id));

    // Cross-user delete after prior delete is expected to be idempotent no-op.
    const delCross = await jsonFetch(baseUrl, `/media/${completed.id}`, {
      method: 'DELETE',
      token: userB.token,
    });
    check('cross-user delete is safe idempotent', delCross.status === 200);
  } finally {
    if (userA || userB) {
      const ids = [userA?.user.id, userB?.user.id].filter(Boolean) as string[];
      await prisma.favorite.deleteMany({ where: { userId: { in: ids } } }).catch(() => undefined);
      await prisma.downloadHistory.deleteMany({ where: { userId: { in: ids } } }).catch(() => undefined);
      await prisma.mediaFolder.deleteMany({ where: { userId: { in: ids } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  }

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    for (const f of failures) {
      console.log(`FAIL  ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
    }
    process.exit(1);
  }
}

void main();

