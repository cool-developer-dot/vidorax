/**
 * Week 8 Day 1 Phase 1 — Media Library API verification (backend).
 * Ephemeral HTTP server. Tagged test users cleaned up afterward.
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week8-day1-phase1.ts
 */
import { createServer } from 'node:http';
import { DownloadStatus, FavoritePlatform } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import * as downloadService from '../src/services/download.service.js';
import * as favoriteService from '../src/services/favorite.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';

const TAG = `w8d1p1-${Date.now()}`;
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
      name: `W8D1 ${suffix}`,
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

const FORBIDDEN_KEYS = [
  'sourceUrl',
  'localUri',
  'absolutePath',
  'errorCode',
  'errorMessage',
  'workerState',
  'retryCount',
  'cookie',
  'cookies',
  'authorization',
];

function assertSafeMedia(value: unknown, label: string): boolean {
  if (!value || typeof value !== 'object') {
    check(`${label} present`, false, 'missing');
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const leaked = FORBIDDEN_KEYS.filter((key) => keys.includes(key));
  check(`${label} omits secrets/paths`, leaked.length === 0, leaked.join(','));
  const blob = JSON.stringify(record);
  const hasDevicePath =
    /\/data\/user\/|content:\/\/|file:\/\/\/storage|VidoraXDownloads/.test(blob);
  check(`${label} has no device path`, !hasDevicePath);
  check(
    `${label} has identity`,
    typeof record.id === 'string' && typeof record.downloadId === 'string',
  );
  return leaked.length === 0 && !hasDevicePath;
}

async function main(): Promise<void> {
  console.log('Week 8 Day 1 Phase 1 — backend media library verifier\n');

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

    const missing = await jsonFetch(baseUrl, '/media/library');
    check('unauthenticated library rejected', missing.status === 401);

    const invalid = await jsonFetch(baseUrl, '/media/library', {
      token: 'not-a-jwt',
    });
    check('invalid token rejected', invalid.status === 401);

    const queued = await downloadService.createDownload(
      userA.user.id,
      mediaPayload(`${TAG} queued`),
    );
    const completed = await downloadService.createDownload(
      userA.user.id,
      mediaPayload(`${TAG} done`),
    );
    await completeJob(userA.user.id, completed.id);

    const foreign = await downloadService.createDownload(
      userB.user.id,
      mediaPayload(`${TAG} foreign`),
    );
    await completeJob(userB.user.id, foreign.id);

    await favoriteService.createFavorite(userA.user.id, {
      title: `${TAG} done`,
      platform: FavoritePlatform.OTHER,
      sourceUrl: completed.sourceUrl,
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    });

    const listed = await jsonFetch(baseUrl, '/media/library?sort=newest&limit=20', {
      token: userA.token,
    });
    check('authenticated library read', listed.status === 200);
    const listData = (listed.body.data ?? {}) as {
      items?: unknown[];
      pagination?: { total?: number; hasMore?: boolean; limit?: number };
    };
    const items = Array.isArray(listData.items) ? listData.items : [];
    check(
      'library returns only own completed',
      items.length === 1 &&
        (items[0] as { id?: string }).id === completed.id,
    );
    if (items[0]) {
      assertSafeMedia(items[0], 'library item');
      const row = items[0] as Record<string, unknown>;
      check('favorite derived from account state', row.favorite === true);
      check('duration not invented', row.duration === null);
      check('folderId prepared as null', row.folderId === null);
    }

    const queuedInLibrary = items.some(
      (entry) => (entry as { id?: string }).id === queued.id,
    );
    check('queued excluded from library', !queuedInLibrary);

    const own = await jsonFetch(baseUrl, `/media/${completed.id}`, {
      token: userA.token,
    });
    check('own media detail succeeds', own.status === 200);
    const ownMedia = (own.body.data as { media?: unknown } | undefined)?.media;
    assertSafeMedia(ownMedia, 'detail');

    const queuedDetail = await jsonFetch(baseUrl, `/media/${queued.id}`, {
      token: userA.token,
    });
    check('queued id is not library media', queuedDetail.status === 404);

    const cross = await jsonFetch(baseUrl, `/media/${foreign.id}`, {
      token: userA.token,
    });
    check('cross-user media ID rejected', cross.status === 404);

    const missingId = await jsonFetch(
      baseUrl,
      '/media/00000000-0000-4000-8000-000000000000',
      { token: userA.token },
    );
    check('unknown id 404', missingId.status === 404);

    const badId = await jsonFetch(baseUrl, '/media/not-a-uuid', {
      token: userA.token,
    });
    check('invalid id rejected', badId.status === 400);

    const badSort = await jsonFetch(baseUrl, '/media/library?sort=recently_played', {
      token: userA.token,
    });
    check('invalid sort rejected', badSort.status === 400);

    const badLimit = await jsonFetch(baseUrl, '/media/library?limit=101', {
      token: userA.token,
    });
    check('pagination bound rejected', badLimit.status === 400);

    const page = await jsonFetch(baseUrl, '/media/library?page=1&limit=1', {
      token: userA.token,
    });
    check('pagination accepted', page.status === 200);

    const favOnly = await jsonFetch(baseUrl, '/media/library?favorite=true', {
      token: userA.token,
    });
    const favItems = ((favOnly.body.data as { items?: unknown[] })?.items ??
      []) as { id?: string }[];
    check(
      'favorite=true returns favorited completed media',
      favOnly.status === 200 &&
        favItems.length === 1 &&
        favItems[0]?.id === completed.id,
    );

    const folderEmpty = await jsonFetch(
      baseUrl,
      '/media/library?folderId=00000000-0000-4000-8000-000000000000',
      { token: userA.token },
    );
    const folderItems =
      ((folderEmpty.body.data as { items?: unknown[] })?.items ?? []) as unknown[];
    check(
      'folderId filter is honest empty',
      folderEmpty.status === 200 && folderItems.length === 0,
    );

    const sizeSort = await jsonFetch(baseUrl, '/media/library?sort=largest', {
      token: userA.token,
    });
    check('largest sort accepted', sizeSort.status === 200);
  } finally {
    if (userA || userB) {
      const ids = [userA?.user.id, userB?.user.id].filter(Boolean) as string[];
      await prisma.favorite.deleteMany({ where: { userId: { in: ids } } });
      await prisma.downloadHistory.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  }

  const failed = results.filter((result) => !result.ok);
  console.log('\n────────────────────────────────────────');
  console.log(
    `Results: ${results.length - failed.length}/${results.length} passed`,
  );
  if (failed.length > 0) {
    for (const item of failed) {
      console.log(`FAIL  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
    }
    process.exit(1);
  }
}

void main();
