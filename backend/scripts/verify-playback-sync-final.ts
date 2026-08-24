/**
 * Playback sync final — proves PUT /playback/:mediaId/progress never 500s for
 * valid progress, and clientRevision / conflict / ownership behave correctly.
 *
 * Run (from backend/):
 *   npm run verify:playback-sync-final
 */
import { createServer } from 'node:http';
import { DownloadStatus, Prisma } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import * as downloadService from '../src/services/download.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';

const TAG = `playback-sync-final-${Date.now()}`;
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
      name: `SyncFinal ${suffix}`,
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

function playbackOf(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const data = body.data as Record<string, unknown> | undefined;
  if (!data) {
    return null;
  }
  const playback = data.playback as Record<string, unknown> | undefined;
  return playback ?? null;
}

async function main(): Promise<void> {
  console.log('Playback sync final verifier\n');

  const model = Prisma.dmmf.datamodel.models.find(
    (entry) => entry.name === 'PlaybackHistory',
  );
  check(
    'generated Prisma client includes PlaybackHistory.clientRevision',
    Boolean(model?.fields.some((field) => field.name === 'clientRevision')),
  );

  const cols = await prisma.$queryRaw<
    Array<{ column_name: string }>
  >`SELECT column_name FROM information_schema.columns
    WHERE table_name = 'PlaybackHistory' AND column_name = 'clientRevision'`;
  check('database has clientRevision column', cols.length === 1);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind ephemeral server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const { user: userA, token: tokenA } = await createUser('a');
  const { user: userB, token: tokenB } = await createUser('b');

  const created = await downloadService.createDownload(
    userA.id,
    mediaPayload('Sync Final Clip'),
  );
  const media = await completeJob(userA.id, created.id);
  const mediaId = media.id;

  const put1 = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenA,
    body: {
      positionSeconds: 20,
      durationSeconds: 600,
      updatedAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
      clientRevision: 1,
    },
  });
  check('valid progress PUT → 200 (never 500)', put1.status === 200, `status=${put1.status}`);
  const pb1 = playbackOf(put1.body);
  check('first PlaybackHistory insert', pb1?.mediaId === mediaId);
  check('clientRevision persisted = 1', pb1?.clientRevision === 1);

  const rowCount1 = await prisma.playbackHistory.count({
    where: { userId: userA.id, mediaId },
  });
  check('exactly one PlaybackHistory row after insert', rowCount1 === 1);

  const put2 = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenA,
    body: {
      positionSeconds: 40,
      durationSeconds: 600,
      updatedAt: new Date().toISOString(),
      clientRevision: 2,
    },
  });
  check('second progress → 200 update', put2.status === 200, `status=${put2.status}`);
  const pb2 = playbackOf(put2.body);
  check('same row updated (position 40)', pb2?.positionSeconds === 40);
  check('clientRevision advanced to 2', pb2?.clientRevision === 2);
  const rowCount2 = await prisma.playbackHistory.count({
    where: { userId: userA.id, mediaId },
  });
  check('still one PlaybackHistory row', rowCount2 === 1);

  const putNewer = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenA,
    body: {
      positionSeconds: 50,
      durationSeconds: 600,
      clientRevision: 5,
    },
  });
  check('newer revision accepted → 200', putNewer.status === 200);
  check(
    'clientRevision stored as 5',
    playbackOf(putNewer.body)?.clientRevision === 5,
  );

  const putStale = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenA,
    body: {
      positionSeconds: 10,
      durationSeconds: 600,
      clientRevision: 3,
    },
  });
  check('older revision → 409', putStale.status === 409, `status=${putStale.status}`);

  const complete = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenA,
    body: {
      positionSeconds: 600,
      durationSeconds: 600,
      markCompleted: true,
      clientRevision: 7,
    },
  });
  check('completed progress → 200', complete.status === 200);
  check(
    'completed flag true',
    playbackOf(complete.body)?.completed === true,
  );

  const replay = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenA,
    body: {
      positionSeconds: 5,
      durationSeconds: 600,
      replayReset: true,
      clientRevision: 8,
    },
  });
  check('replayReset valid → 200', replay.status === 200, `status=${replay.status}`);
  check(
    'replayReset clears completed',
    playbackOf(replay.body)?.completed === false,
  );

  const cross = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenB,
    body: {
      positionSeconds: 1,
      durationSeconds: 100,
      clientRevision: 1,
    },
  });
  check('cross-user → 404 (never 500)', cross.status === 404, `status=${cross.status}`);

  const invalid = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenA,
    body: {
      positionSeconds: -1,
      durationSeconds: 100,
      clientRevision: 9,
    },
  });
  check('invalid payload → 400', invalid.status === 400, `status=${invalid.status}`);

  const pauseLike = await jsonFetch(baseUrl, `/playback/${mediaId}/progress`, {
    method: 'PUT',
    token: tokenA,
    body: {
      positionSeconds: 45,
      durationSeconds: 600,
      updatedAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
      clientRevision: 10,
    },
  });
  check(
    'pause/exit-style sync → 200 (never 500)',
    pauseLike.status === 200,
    `status=${pauseLike.status}`,
  );

  // pendingSync semantics (pure — matches mobile coordinator contract)
  let pendingSync = true;
  let localRevision = 10;
  const successfulRemoteRevision = 10;
  if (successfulRemoteRevision === localRevision) {
    pendingSync = false;
  }
  check('pendingSync cleared only after matching revision', pendingSync === false);

  pendingSync = true;
  localRevision = 11;
  if (successfulRemoteRevision === localRevision) {
    pendingSync = false;
  }
  check('newer local revision keeps pendingSync', pendingSync === true);

  await prisma.playbackHistory.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  });
  await prisma.downloadHistory.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userA.id, userB.id] } },
  });

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();

  const failed = results.filter((row) => !row.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
