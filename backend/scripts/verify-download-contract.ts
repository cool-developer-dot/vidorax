/**
 * Sequential Day 4 Phase 1 download contract verification.
 * Spins an ephemeral HTTP server (random port) — does not touch PORT 3105.
 * Creates only tagged test users/rows and deletes them afterward.
 */
import { createServer } from 'node:http';
import { DownloadStatus } from '@prisma/client';
import app from '../src/app.js';
import { prisma } from '../src/database/index.js';
import * as downloadService from '../src/services/download.service.js';
import { hashPassword } from '../src/security/index.js';
import { generateAccessToken } from '../src/security/jwt/index.js';
import { analyzeUrl } from '../src/services/media-analysis/index.js';
import { AppError } from '../src/utils/errors/index.js';

const TAG = `w6d4p1-${Date.now()}`;
const PASSWORD = 'TestPass123!';

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];

const check = (name: string, ok: boolean, detail?: string): void => {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const expectAppError = async (
  name: string,
  statusCode: number,
  fn: () => Promise<unknown>,
): Promise<void> => {
  try {
    await fn();
    check(name, false, 'expected AppError');
  } catch (error) {
    const ok =
      error instanceof AppError && error.statusCode === statusCode;
    check(
      name,
      ok,
      ok
        ? undefined
        : `got ${error instanceof AppError ? error.statusCode : String(error)}`,
    );
  }
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
      name: `Phase1 ${suffix}`,
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
});

async function main(): Promise<void> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind ephemeral server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let userA: Awaited<ReturnType<typeof createUser>> | null = null;
  let userB: Awaited<ReturnType<typeof createUser>> | null = null;
  const createdIds: string[] = [];

  try {
    userA = await createUser('a');
    userB = await createUser('b');

    // ── Auth ──────────────────────────────────────────────────────────
    {
      const missing = await jsonFetch(baseUrl, '/downloads', { method: 'GET' });
      check('auth missing token', missing.status === 401);

      const invalid = await jsonFetch(baseUrl, '/downloads', {
        method: 'GET',
        token: 'not-a-jwt',
      });
      check('auth invalid token', invalid.status === 401);
    }

    // ── Analyze no-write ──────────────────────────────────────────────
    {
      const before = await prisma.downloadHistory.count({
        where: { userId: userA.user.id },
      });
      try {
        await analyzeUrl('https://example.com/not-a-real-media.bin');
      } catch {
        // network/analysis failure is fine — must not write
      }
      const analyzeHttp = await jsonFetch(baseUrl, '/downloads/analyze', {
        method: 'POST',
        token: userA.token,
        body: { url: 'https://example.com/sample.mp4' },
      });
      check(
        'analyze responds without create requirement',
        analyzeHttp.status === 200 || analyzeHttp.status === 400,
        `status=${analyzeHttp.status}`,
      );
      const after = await prisma.downloadHistory.count({
        where: { userId: userA.user.id },
      });
      check('analyze no-write', before === after, `before=${before} after=${after}`);
    }

    // ── Create ────────────────────────────────────────────────────────
    const created = await downloadService.createDownload(
      userA.user.id,
      mediaPayload(`${TAG}-job-a`),
    );
    createdIds.push(created.id);
    check(
      'create QUEUED defaults',
      created.status === DownloadStatus.QUEUED &&
        created.progress === 0 &&
        created.errorCode === null &&
        created.errorMessage === null &&
        created.downloadedAt === null &&
        created.userId === userA.user.id,
    );

    const createHttp = await jsonFetch(baseUrl, '/downloads', {
      method: 'POST',
      token: userA.token,
      body: {
        ...mediaPayload(`${TAG}-job-http`),
        status: 'COMPLETED',
        userId: userB.user.id,
        progress: 99,
      },
    });
    check(
      'create rejects mass assignment / unknown fields',
      createHttp.status === 400,
      `status=${createHttp.status}`,
    );

    const createOk = await jsonFetch(baseUrl, '/downloads', {
      method: 'POST',
      token: userA.token,
      body: mediaPayload(`${TAG}-job-http-ok`),
    });
    check('create HTTP 201', createOk.status === 201, `status=${createOk.status}`);
    const createData = (createOk.body.data ?? {}) as {
      download?: { id?: string; status?: string; userId?: string };
    };
    const httpDownload = createData.download ?? {};
    if (httpDownload.id) {
      createdIds.push(httpDownload.id);
    }
    check(
      'create ownership server-controlled',
      httpDownload.userId === userA.user.id && httpDownload.status === 'QUEUED',
      `userId=${httpDownload.userId} status=${httpDownload.status}`,
    );

    // ── List scoped ───────────────────────────────────────────────────
    const listed = await downloadService.listDownloads(
      userA.user.id,
      { page: 1, limit: 50, offset: 0 },
      {},
    );
    check(
      'list user-scoped',
      listed.items.every((item) => item.userId === userA!.user.id) &&
        listed.items.some((item) => item.id === created.id),
    );

    // ── Get ownership ─────────────────────────────────────────────────
    const got = await downloadService.getDownload(userA.user.id, created.id);
    check('get own download', got.id === created.id);

    await expectAppError('get cross-user → 404', 404, () =>
      downloadService.getDownload(userB.user.id, created.id),
    );

    const crossGet = await jsonFetch(baseUrl, `/downloads/${created.id}`, {
      token: userB.token,
    });
    check(
      'cross-user GET',
      crossGet.status === 404 &&
        !JSON.stringify(crossGet.body).includes(created.sourceUrl),
      `status=${crossGet.status}`,
    );

    // ── Progress + transitions ────────────────────────────────────────
    let job = await downloadService.updateDownload(userA.user.id, created.id, {
      status: DownloadStatus.DOWNLOADING,
      progress: 10,
    });
    check('QUEUED → DOWNLOADING', job.status === DownloadStatus.DOWNLOADING);

    job = await downloadService.updateDownload(userA.user.id, created.id, {
      progress: 43,
    });
    check('valid progress increase', job.progress === 43);

    await expectAppError('progress > 100', 400, () =>
      downloadService.updateDownload(userA.user.id, created.id, {
        progress: 101,
      }),
    );

    await expectAppError('progress regression', 409, () =>
      downloadService.updateDownload(userA.user.id, created.id, {
        progress: 40,
      }),
    );

    job = await downloadService.pauseDownload(userA.user.id, created.id);
    check('DOWNLOADING → PAUSED', job.status === DownloadStatus.PAUSED);

    job = await downloadService.resumeDownload(userA.user.id, created.id);
    check('PAUSED → DOWNLOADING', job.status === DownloadStatus.DOWNLOADING);

    job = await downloadService.failDownload(userA.user.id, created.id, {
      errorCode: 'NETWORK_TIMEOUT',
      errorMessage: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb timeout https://cdn.example.com/x?token=secret',
    });
    check(
      '→ FAILED with sanitized error',
      job.status === DownloadStatus.FAILED &&
        job.errorCode === 'NETWORK_TIMEOUT' &&
        !!job.errorMessage &&
        !job.errorMessage.includes('Bearer eyJ') &&
        !job.errorMessage.includes('token=secret') &&
        job.progress === 43,
    );

    job = await downloadService.retryDownload(userA.user.id, created.id);
    check(
      'FAILED → QUEUED retry clears errors',
      job.status === DownloadStatus.QUEUED &&
        job.errorCode === null &&
        job.errorMessage === null &&
        job.progress === 43,
    );

    job = await downloadService.updateDownload(userA.user.id, created.id, {
      status: DownloadStatus.DOWNLOADING,
      progress: 50,
    });
    job = await downloadService.updateDownload(userA.user.id, created.id, {
      status: DownloadStatus.COMPLETED,
      progress: 100,
    });
    check(
      '→ COMPLETED sets downloadedAt',
      job.status === DownloadStatus.COMPLETED &&
        job.progress === 100 &&
        job.downloadedAt !== null &&
        job.errorCode === null,
    );

    await expectAppError('COMPLETED → DOWNLOADING rejected', 409, () =>
      downloadService.updateDownload(userA.user.id, created.id, {
        status: DownloadStatus.DOWNLOADING,
      }),
    );

    // Second job for cancel terminality
    const cancelJob = await downloadService.createDownload(
      userA.user.id,
      mediaPayload(`${TAG}-cancel`),
    );
    createdIds.push(cancelJob.id);
    await downloadService.updateDownload(userA.user.id, cancelJob.id, {
      status: DownloadStatus.DOWNLOADING,
    });
    const cancelled = await downloadService.cancelDownload(
      userA.user.id,
      cancelJob.id,
    );
    check('→ CANCELLED', cancelled.status === DownloadStatus.CANCELLED);

    await expectAppError('CANCELLED → QUEUED rejected', 409, () =>
      downloadService.updateDownload(userA.user.id, cancelJob.id, {
        status: DownloadStatus.QUEUED,
      }),
    );

    // Idempotent cancel
    const cancelAgain = await downloadService.cancelDownload(
      userA.user.id,
      cancelJob.id,
    );
    check(
      'idempotent CANCELLED no-op',
      cancelAgain.status === DownloadStatus.CANCELLED,
    );

    // ── Cross-user mutations ──────────────────────────────────────────
    const foreign = await downloadService.createDownload(
      userA.user.id,
      mediaPayload(`${TAG}-foreign`),
    );
    createdIds.push(foreign.id);

    const crossPatch = await jsonFetch(baseUrl, `/downloads/${foreign.id}`, {
      method: 'PATCH',
      token: userB.token,
      body: { status: 'PAUSED' },
    });
    check('cross-user PATCH', crossPatch.status === 404);

    await expectAppError('cross-user pause', 404, () =>
      downloadService.pauseDownload(userB.user.id, foreign.id),
    );
    await expectAppError('cross-user resume', 404, () =>
      downloadService.resumeDownload(userB.user.id, foreign.id),
    );
    await expectAppError('cross-user retry', 404, () =>
      downloadService.retryDownload(userB.user.id, foreign.id),
    );
    await expectAppError('cross-user cancel', 404, () =>
      downloadService.cancelDownload(userB.user.id, foreign.id),
    );

    const crossDelete = await jsonFetch(baseUrl, `/downloads/${foreign.id}`, {
      method: 'DELETE',
      token: userB.token,
    });
    check('cross-user DELETE', crossDelete.status === 404);

    const stillThere = await downloadService.getDownload(
      userA.user.id,
      foreign.id,
    );
    check('cross-user DELETE did not remove', stillThere.id === foreign.id);

    // ── Own delete ────────────────────────────────────────────────────
    await downloadService.deleteDownload(userA.user.id, foreign.id);
    createdIds.splice(createdIds.indexOf(foreign.id), 1);
    await expectAppError('delete own then gone', 404, () =>
      downloadService.getDownload(userA.user.id, foreign.id),
    );
    check('delete own job', true);
  } finally {
    if (createdIds.length > 0) {
      await prisma.downloadHistory.deleteMany({
        where: { id: { in: createdIds } },
      });
    }
    if (userA || userB) {
      await prisma.downloadHistory.deleteMany({
        where: {
          userId: {
            in: [userA?.user.id, userB?.user.id].filter(Boolean) as string[],
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [userA?.user.id, userB?.user.id].filter(Boolean) as string[],
          },
        },
      });
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

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
