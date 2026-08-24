/**
 * Week 8 Day 4 Phase 2 — security, IDOR, DTO privacy, query bounds (backend).
 * Ephemeral HTTP server. Tagged test users cleaned up afterward.
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week8-day4-phase2.ts
 */
import { createServer } from 'node:http';
import { DownloadStatus } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import { MAX_PAGE_LIMIT } from '../src/utils/pagination.js';
import * as downloadService from '../src/services/download.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';

const TAG_PREFIX = 'w8d4p2-';
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
      name: `W8D4P2 ${suffix}`,
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

const unwrap = (body: Record<string, unknown>): Record<string, unknown> =>
  (body.data as Record<string, unknown> | undefined) ?? body;

async function main(): Promise<void> {
  console.log('Week 8 Day 4 Phase 2 — backend security verifier\n');

  await prisma.user
    .deleteMany({ where: { email: { startsWith: TAG_PREFIX } } })
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
    check('page limit is bounded', MAX_PAGE_LIMIT === 100);

    userA = await createUser('a');
    userB = await createUser('b');

    const routes = [
      '/downloads',
      '/media/library',
      '/playback/history',
      '/favorites',
      '/media/folders',
    ];
    for (const path of routes) {
      const res = await jsonFetch(baseUrl, path);
      check(`${path} requires JWT`, res.status === 401);
    }

    const mediaA = await completeJob(
      userA.user.id,
      (await downloadService.createDownload(userA.user.id, mediaPayload(`${TAG} a`))).id,
    );
    const mediaA2 = await completeJob(
      userA.user.id,
      (await downloadService.createDownload(userA.user.id, mediaPayload(`${TAG} a2`))).id,
    );

    const library = await jsonFetch(baseUrl, '/media/library?limit=100', {
      token: userA.token,
    });
    check('library list 200', library.status === 200);
    const libData = unwrap(library.body);
    const pagination = libData.pagination as { limit?: number } | undefined;
    check(
      'library limit is bounded',
      pagination?.limit === MAX_PAGE_LIMIT || pagination?.limit === 100,
      String(pagination?.limit),
    );
    const overLimit = await jsonFetch(baseUrl, '/media/library?limit=500', {
      token: userA.token,
    });
    check('library rejects unbounded limit', overLimit.status === 400);
    const libItems = (libData.items as Array<Record<string, unknown>>) ?? [];
    const leaked = libItems.some(
      (row) =>
        'userId' in row ||
        'sourceUrl' in row ||
        'localUri' in row ||
        'path' in row ||
        'workerState' in row,
    );
    check('library DTO has no userId/path/sourceUrl/worker internals', !leaked);

    const getCross = await jsonFetch(baseUrl, `/media/${mediaA.id}`, {
      token: userB.token,
    });
    const getMissing = await jsonFetch(
      baseUrl,
      '/media/00000000-0000-4000-8000-000000000000',
      { token: userB.token },
    );
    check('IDOR GET media is 404', getCross.status === 404);
    check(
      'IDOR GET does not distinguish missing vs other-user',
      getCross.status === getMissing.status,
    );

    const renameCross = await jsonFetch(baseUrl, `/media/${mediaA.id}/rename`, {
      method: 'PATCH',
      token: userB.token,
      body: { displayName: `${TAG} stolen.mp4` },
    });
    check('IDOR PATCH rename is 404', renameCross.status === 404);

    const traversal = await jsonFetch(baseUrl, `/media/${mediaA.id}/rename`, {
      method: 'PATCH',
      token: userA.token,
      body: { displayName: '../video.mp4' },
    });
    check('rename rejects traversal', traversal.status === 400);

    const dots = await jsonFetch(baseUrl, `/media/${mediaA.id}/rename`, {
      method: 'PATCH',
      token: userA.token,
      body: { displayName: '...' },
    });
    check('rename rejects dot-only name', dots.status === 400);

    const collide = await jsonFetch(baseUrl, `/media/${mediaA2.id}/rename`, {
      method: 'PATCH',
      token: userA.token,
      body: { displayName: mediaA.fileName },
    });
    check('rename collision is 409', collide.status === 409, String(collide.status));

    const playCross = await jsonFetch(baseUrl, `/playback/${mediaA.id}`, {
      token: userB.token,
    });
    check('IDOR GET playback is 404', playCross.status === 404);

    const folder = await jsonFetch(baseUrl, '/media/folders', {
      method: 'POST',
      token: userA.token,
      body: { name: `${TAG} folder` },
    });
    check('create folder 201/200', folder.status === 201 || folder.status === 200);
    const folderPayload = unwrap(folder.body);
    const folderObj = (folderPayload.folder ?? folderPayload) as {
      id?: string;
      userId?: string;
    };
    check('folder DTO has no userId', !('userId' in folderObj));
    const folderId = folderObj.id as string;

    const folderCross = await jsonFetch(baseUrl, `/media/folders/${folderId}`, {
      method: 'PATCH',
      token: userB.token,
      body: { name: 'stolen' },
    });
    check('IDOR PATCH folder is 404', folderCross.status === 404);

    const folderDelCross = await jsonFetch(baseUrl, `/media/folders/${folderId}`, {
      method: 'DELETE',
      token: userB.token,
    });
    check('IDOR DELETE folder is 404', folderDelCross.status === 404);

    const fav = await jsonFetch(baseUrl, '/favorites', {
      method: 'POST',
      token: userA.token,
      body: {
        title: `${TAG} fav`,
        platform: 'OTHER',
        sourceUrl: mediaA.sourceUrl,
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      },
    });
    check('create favorite 201/200', fav.status === 201 || fav.status === 200);
    const favObj = unwrap(fav.body).favorite as Record<string, unknown> | undefined
      ?? unwrap(fav.body);
    check('favorite DTO has no userId', !('userId' in favObj));
    const favId = favObj.id as string;
    const favDelCross = await jsonFetch(baseUrl, `/favorites/${favId}`, {
      method: 'DELETE',
      token: userB.token,
    });
    check('IDOR DELETE favorite is 404', favDelCross.status === 404);

    const randomId = '00000000-0000-4000-8000-000000000099';
    const delCross = await jsonFetch(baseUrl, `/media/${mediaA.id}`, {
      method: 'DELETE',
      token: userB.token,
    });
    const delMissing = await jsonFetch(baseUrl, `/media/${randomId}`, {
      method: 'DELETE',
      token: userB.token,
    });
    check(
      'IDOR DELETE media matches missing (no existence leak)',
      delCross.status === delMissing.status,
      `${delCross.status} vs ${delMissing.status}`,
    );
    const stillThere = await jsonFetch(baseUrl, `/media/${mediaA.id}`, {
      token: userA.token,
    });
    check('cross-user delete did not remove owner media', stillThere.status === 200);

    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'DownloadHistory'
    `;
    const names = indexes.map((row) => row.indexname);
    check(
      'userId+status+folderId index',
      names.some((name) => name.includes('userId_status_folderId')),
      names.join(','),
    );
  } catch (error) {
    check(
      'verifier crashed',
      false,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    try {
      const ids = [userA?.user.id, userB?.user.id].filter(
        (id): id is string => Boolean(id),
      );
      if (ids.length > 0) {
        await prisma.playbackHistory.deleteMany({ where: { userId: { in: ids } } });
        await prisma.favorite.deleteMany({ where: { userId: { in: ids } } });
        await prisma.downloadHistory.deleteMany({ where: { userId: { in: ids } } });
        await prisma.mediaFolder.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    } catch {
      // best-effort cleanup
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  const failed = results.filter((row) => !row.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
