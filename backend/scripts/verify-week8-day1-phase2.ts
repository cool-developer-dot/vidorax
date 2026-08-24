/**
 * Week 8 Day 1 Phase 2 — Favorites + Folder organization verification (backend).
 *
 * Ephemeral HTTP server. Tagged test users cleaned up afterward.
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week8-day1-phase2.ts
 */
import { createServer } from 'node:http';
import { DownloadStatus } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import * as downloadService from '../src/services/download.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';

const TAG_PREFIX = 'w8d1p2-';
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
      name: `W8D1P2 ${suffix}`,
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
  return leaked.length === 0 && !hasDevicePath;
}

async function main(): Promise<void> {
  console.log('Week 8 Day 1 Phase 2 — backend folder/favorite verifier\n');

  // Safety: prior failed runs may have left users around; delete by prefix.
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
    userA = await createUser('a');
    userB = await createUser('b');

    // Create completed media for A.
    const completed1 = await downloadService.createDownload(
      userA.user.id,
      mediaPayload(`${TAG} media1`),
    );
    const completed2 = await downloadService.createDownload(
      userA.user.id,
      mediaPayload(`${TAG} media2`),
    );
    await completeJob(userA.user.id, completed1.id);
    await completeJob(userA.user.id, completed2.id);

    // Create one completed media for B (used for cross-user safety).
    const completedB = await downloadService.createDownload(
      userB.user.id,
      mediaPayload(`${TAG} mediaB`),
    );
    await completeJob(userB.user.id, completedB.id);

    // Folder CRUD sanity (and ensures /media/folders route isn't shadowed by /media/:id).
    const listFoldersUnauth = await jsonFetch(baseUrl, '/media/folders');
    check('unauth /media/folders rejected', listFoldersUnauth.status === 401);

    const createFolder = async (token: string, name: string) => {
      const r = await jsonFetch(baseUrl, '/media/folders', {
        method: 'POST',
        token,
        body: { name },
      });
      check(`create folder ${name}`, r.status === 201);
      const folder = (r.body.data as { folder?: unknown }).folder;
      if (!folder || typeof folder !== 'object') throw new Error('folder missing');
      const id = (folder as { id?: unknown }).id;
      if (typeof id !== 'string') throw new Error('folder.id missing');
      return id;
    };

    const folderAName = 'Travel';
    const folderBName = 'Music';

    const folderAId = await createFolder(userA.token, folderAName);
    const folderBId = await createFolder(userA.token, folderBName);
    const folderB_OwnerBId = await createFolder(userB.token, `${TAG} B-folder`);

    const listFoldersA = await jsonFetch(baseUrl, '/media/folders', {
      token: userA.token,
    });
    const folders = (listFoldersA.body.data as { items?: unknown[] }).items ?? [];
    check('list folders returns items array', Array.isArray(folders));
    check('list folders returns A folders', (folders as unknown[]).length >= 2);

    // Assign media into folders.
    const assignToFolder = async (token: string, mediaId: string, target: string | null) => {
      const r = await jsonFetch(baseUrl, `/media/${mediaId}/folder`, {
        method: 'PATCH',
        token,
        body: { folderId: target },
      });
      check(`assign folderId=${target ?? 'null'} for media ${mediaId}`, r.status === 200);
      const folderIdResp = (r.body.data as { folderId?: unknown }).folderId;
      return typeof folderIdResp === 'string' || folderIdResp === null ? folderIdResp : undefined;
    };

    await assignToFolder(userA.token, completed1.id, folderAId);
    await assignToFolder(userA.token, completed2.id, folderBId);

    // Move one back to Unfiled (folderId = null).
    await assignToFolder(userA.token, completed2.id, null);

    // Verify listMediaLibrary returns correct folderId + folderName.
    const listLibrary = async (token: string) => {
      const r = await jsonFetch(baseUrl, `/media/library?sort=newest&limit=20`, { token });
      check('list media library', r.status === 200);
      const data = r.body.data as { items?: unknown[] } | undefined;
      const items = (data?.items ?? []) as unknown[];
      return items;
    };

    const itemsAfterFolder = await listLibrary(userA.token);
    const byId: Record<string, any> = Object.fromEntries(
      (itemsAfterFolder as any[]).map((x) => [x?.id, x]),
    );

    const row1 = byId[completed1.id];
    const row2 = byId[completed2.id];
    check('media1 assigned folderId', row1?.folderId === folderAId);
    check('media2 unfiled folderId', row2?.folderId === null);
    check('media2 unfiled folderName', row2?.folderName === 'Downloads / Unfiled');
    assertSafeMedia(row1, 'library item1');
    assertSafeMedia(row2, 'library item2');

    // Delete folderB and ensure associated items become Unfiled.
    // First assign media2 back into folderB so deletion has an effect.
    await assignToFolder(userA.token, completed2.id, folderBId);
    const deleteFolder = await jsonFetch(baseUrl, `/media/folders/${folderBId}`, {
      method: 'DELETE',
      token: userA.token,
    });
    check('delete folder succeeds', deleteFolder.status === 200);

    const itemsAfterDelete = await listLibrary(userA.token);
    const byIdAfterDelete: Record<string, any> = Object.fromEntries(
      (itemsAfterDelete as any[]).map((x) => [x?.id, x]),
    );
    const row2After = byIdAfterDelete[completed2.id];
    check('media2 becomes unfiled after folder delete', row2After?.folderId === null);
    check(
      'media2 becomes unfiled folderName after folder delete',
      row2After?.folderName === 'Downloads / Unfiled',
    );

    // Cross-user assignment safety (IDOR).
    const crossAssign = await jsonFetch(baseUrl, `/media/${completed1.id}/folder`, {
      method: 'PATCH',
      token: userB.token,
      body: { folderId: folderB_OwnerBId },
    });
    check('cross-user folder assignment rejected', crossAssign.status === 404);

    // Favorites patch endpoint (mediaId-based, idempotent, cross-user safe).
    const patchFavorite = async (token: string, mediaId: string, favorite: boolean) => {
      const r = await jsonFetch(baseUrl, `/media/${mediaId}/favorite`, {
        method: 'PATCH',
        token,
        body: { favorite },
      });
      check(`patch favorite=${favorite} for media ${mediaId}`, r.status === 200);
      return r;
    };

    await patchFavorite(userA.token, completed1.id, true);
    // Idempotent: patch true again.
    await patchFavorite(userA.token, completed1.id, true);
    await patchFavorite(userA.token, completed1.id, false);

    const itemsAfterFav = await listLibrary(userA.token);
    const byIdFav: Record<string, any> = Object.fromEntries(
      (itemsAfterFav as any[]).map((x) => [x?.id, x]),
    );
    check('media1 favorite reflected after patch', byIdFav[completed1.id]?.favorite === false);

    const crossFav = await jsonFetch(baseUrl, `/media/${completed1.id}/favorite`, {
      method: 'PATCH',
      token: userB.token,
      body: { favorite: true },
    });
    check('cross-user favorite patch rejected', crossFav.status === 404);

    const crossFav2 = await jsonFetch(
      baseUrl,
      `/media/${completedB.id}/favorite`,
      {
        method: 'PATCH',
        token: userA.token,
        body: { favorite: true },
      },
    );
    check('cross-user favorite patch rejected (other user media)', crossFav2.status === 404);

    // Final: ensure folder + favorite data is presentation-safe.
    const finalItems = await listLibrary(userA.token);
    for (const row of finalItems as any[]) {
      assertSafeMedia(row, 'final library item');
    }
  } finally {
    // Ensure no test data leaks (user-scoped cleanup).
    if (userA || userB) {
      const ids = [userA?.user.id, userB?.user.id].filter(Boolean) as string[];
      await prisma.favorite.deleteMany({ where: { userId: { in: ids } } }).catch(
        () => undefined,
      );
      await prisma.downloadHistory.deleteMany({ where: { userId: { in: ids } } }).catch(
        () => undefined,
      );
      await prisma.mediaFolder.deleteMany({ where: { userId: { in: ids } } }).catch(
        () => undefined,
      );
      await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(
        () => undefined,
      );
    }
    server.close();
  }

  const failures = results.filter((r) => !r.ok).length;
  console.log(`\nWeek 8 Day 1 Phase 2 (backend) — failures: ${failures}`);
  if (failures > 0) process.exit(1);
}

void main();

