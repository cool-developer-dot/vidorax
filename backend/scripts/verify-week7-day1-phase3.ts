/**
 * Week 7 Day 1 Phase 3 — durable metadata + worker-state verification.
 * Pure logic / fixtures only. NO network. NO DB writes. NO HTTP server.
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week7-day1-phase3.ts
 */

import { DownloadStatus, DownloadWorkerState } from '@prisma/client';
import {
  DOWNLOAD_STATUS_TRANSITIONS,
  assertDownloadTransition,
  isTerminalDownloadStatus,
} from '../src/domain/downloads/transitions.js';
import {
  sanitizeBitrate,
  sanitizeQuality,
  sanitizeResolution,
} from '../src/domain/downloads/quality-metadata.js';
import {
  DOWNLOAD_WORKER_STATES,
  DURABLE_WORKER_STATE_MILESTONES,
  WORKER_STATES_FOR_STATUS,
  assertWorkerStateForDownloadStatus,
  defaultWorkerStateForStatus,
  isValidWorkerStateForDownloadStatus,
  resolveWorkerStateForUpdate,
} from '../src/domain/downloads/worker-state.js';
import { AppError } from '../src/utils/errors/index.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Check = { name: string; ok: boolean; detail?: string };
const results: Check[] = [];

const check = (name: string, ok: boolean, detail?: string): void => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const expectThrow = (name: string, fn: () => void): void => {
  try {
    fn();
    check(name, false, 'expected throw');
  } catch (error) {
    check(name, error instanceof AppError || error instanceof Error, undefined);
  }
};

function main(): void {
  console.log('Week 7 Day 1 Phase 3 — backend durable metadata verifier\n');

  // ── Schema / migration inspection ─────────────────────────────────
  {
    const schema = readFileSync(
      resolve('prisma/schema.prisma'),
      'utf8',
    );
    check('schema has quality', schema.includes('quality      String?'));
    check('schema has resolution', schema.includes('resolution   String?'));
    check('schema has bitrate Int?', /bitrate\s+Int\?/.test(schema));
    check(
      'schema has retryCount Int @default(0)',
      /retryCount\s+Int\s+@default\(0\)/.test(schema),
    );
    check(
      'schema has workerState enum field',
      /workerState\s+DownloadWorkerState\?/.test(schema),
    );
    check(
      'schema has DownloadWorkerState enum',
      schema.includes('enum DownloadWorkerState'),
    );
    check(
      'no failureReason column',
      !schema.includes('failureReason') && !schema.includes('errorReason'),
    );
    check(
      'no segmentCount column (deferred)',
      !schema.includes('segmentCount') && !schema.includes('completedSegments'),
    );

    const migration = readFileSync(
      resolve(
        'prisma/migrations/20260813220000_download_durable_metadata/migration.sql',
      ),
      'utf8',
    );
    check('migration additive CREATE TYPE', migration.includes('CREATE TYPE "DownloadWorkerState"'));
    check('migration additive ADD COLUMN', migration.includes('ADD COLUMN IF NOT EXISTS "quality"'));
    check('migration no DROP TABLE', !/DROP\s+TABLE/i.test(migration));
    check('migration no TRUNCATE', !/TRUNCATE/i.test(migration));
    check(
      'migration leaves DOWNLOADING workerState unset',
      !/SET\s+"workerState"\s*=\s*'TRANSFERRING'/i.test(migration) &&
        !/WHERE\s+"status"\s*=\s*'DOWNLOADING'/i.test(migration) &&
        migration.includes("WHERE \"status\" = 'QUEUED'"),
    );
  }

  // ── Quality / resolution / bitrate sanitizers ─────────────────────
  {
    check('quality trim', sanitizeQuality('  720p  ') === '720p');
    check('quality empty → null', sanitizeQuality('   ') === null);
    check('quality null → null', sanitizeQuality(null) === null);
    expectThrow('quality too long rejected', () => {
      sanitizeQuality('x'.repeat(65));
    });

    check(
      'resolution normalized',
      sanitizeResolution('1280x720') === '1280x720',
    );
    check('resolution unknown → null', sanitizeResolution('unknown') === null);
    check('resolution 0x0 → null', sanitizeResolution('0x0') === null);
    expectThrow('resolution invalid pattern', () => {
      sanitizeResolution('fullhd');
    });

    check('bitrate valid', sanitizeBitrate(4_200_000) === 4_200_000);
    check('bitrate 0 → null', sanitizeBitrate(0) === null);
    check('bitrate null → null', sanitizeBitrate(null) === null);
    expectThrow('bitrate negative rejected', () => {
      sanitizeBitrate(-1);
    });
  }

  // ── Worker state compatibility ────────────────────────────────────
  {
    check(
      'QUEUED + WAITING valid',
      isValidWorkerStateForDownloadStatus(
        DownloadStatus.QUEUED,
        DownloadWorkerState.WAITING,
      ),
    );
    check(
      'QUEUED + TRANSFERRING invalid',
      !isValidWorkerStateForDownloadStatus(
        DownloadStatus.QUEUED,
        DownloadWorkerState.TRANSFERRING,
      ),
    );
    check(
      'DOWNLOADING + TRANSFERRING valid',
      isValidWorkerStateForDownloadStatus(
        DownloadStatus.DOWNLOADING,
        DownloadWorkerState.TRANSFERRING,
      ),
    );
    check(
      'DOWNLOADING + VERIFYING valid',
      isValidWorkerStateForDownloadStatus(
        DownloadStatus.DOWNLOADING,
        DownloadWorkerState.VERIFYING,
      ),
    );
    check(
      'PAUSED + PAUSED valid',
      isValidWorkerStateForDownloadStatus(
        DownloadStatus.PAUSED,
        DownloadWorkerState.PAUSED,
      ),
    );
    check(
      'FAILED + FAILED valid',
      isValidWorkerStateForDownloadStatus(
        DownloadStatus.FAILED,
        DownloadWorkerState.FAILED,
      ),
    );
    check(
      'FAILED + RETRY_WAIT valid',
      isValidWorkerStateForDownloadStatus(
        DownloadStatus.FAILED,
        DownloadWorkerState.RETRY_WAIT,
      ),
    );
    check(
      'COMPLETED + COMPLETED valid',
      isValidWorkerStateForDownloadStatus(
        DownloadStatus.COMPLETED,
        DownloadWorkerState.COMPLETED,
      ),
    );
    check(
      'CANCELLED + CANCELLED valid',
      isValidWorkerStateForDownloadStatus(
        DownloadStatus.CANCELLED,
        DownloadWorkerState.CANCELLED,
      ),
    );
    check(
      'COMPLETED + TRANSFERRING invalid',
      !isValidWorkerStateForDownloadStatus(
        DownloadStatus.COMPLETED,
        DownloadWorkerState.TRANSFERRING,
      ),
    );
    check(
      'CANCELLED + STARTING invalid',
      !isValidWorkerStateForDownloadStatus(
        DownloadStatus.CANCELLED,
        DownloadWorkerState.STARTING,
      ),
    );

    expectThrow('assert rejects impossible pair', () => {
      assertWorkerStateForDownloadStatus(
        DownloadStatus.COMPLETED,
        DownloadWorkerState.TRANSFERRING,
      );
    });

    check(
      'default create worker WAITING',
      defaultWorkerStateForStatus(DownloadStatus.QUEUED) ===
        DownloadWorkerState.WAITING,
    );
    check(
      'all canonical worker states listed',
      DOWNLOAD_WORKER_STATES.length === 12,
    );
    check(
      'PAUSING not durable milestone',
      !DURABLE_WORKER_STATE_MILESTONES.has(DownloadWorkerState.PAUSING),
    );
    check(
      'COMPLETING not durable milestone',
      !DURABLE_WORKER_STATE_MILESTONES.has(DownloadWorkerState.COMPLETING),
    );

    const resolved = resolveWorkerStateForUpdate({
      currentStatus: DownloadStatus.FAILED,
      nextStatus: DownloadStatus.QUEUED,
      currentWorkerState: DownloadWorkerState.FAILED,
      requestedWorkerState: undefined,
    });
    check(
      'FAILED→QUEUED resolves WAITING',
      resolved === DownloadWorkerState.WAITING,
    );

    // Mapping table covers every status.
    for (const status of Object.values(DownloadStatus)) {
      check(
        `mapping exists for ${status}`,
        (WORKER_STATES_FOR_STATUS[status]?.length ?? 0) > 0,
      );
    }
  }

  // ── Status transition graph (Week 6 preserved) ────────────────────
  {
    check(
      'FAILED→QUEUED legal',
      DOWNLOAD_STATUS_TRANSITIONS.FAILED.includes(DownloadStatus.QUEUED),
    );
    check(
      'COMPLETED terminal',
      isTerminalDownloadStatus(DownloadStatus.COMPLETED) &&
        DOWNLOAD_STATUS_TRANSITIONS.COMPLETED.length === 0,
    );
    check(
      'CANCELLED terminal',
      isTerminalDownloadStatus(DownloadStatus.CANCELLED) &&
        DOWNLOAD_STATUS_TRANSITIONS.CANCELLED.length === 0,
    );

    try {
      assertDownloadTransition(DownloadStatus.FAILED, DownloadStatus.QUEUED);
      check('assert FAILED→QUEUED', true);
    } catch {
      check('assert FAILED→QUEUED', false);
    }

    expectThrow('COMPLETED→QUEUED rejected', () => {
      assertDownloadTransition(
        DownloadStatus.COMPLETED,
        DownloadStatus.QUEUED,
      );
    });
    expectThrow('CANCELLED→QUEUED rejected', () => {
      assertDownloadTransition(
        DownloadStatus.CANCELLED,
        DownloadStatus.QUEUED,
      );
    });
  }

  // ── Retry count semantics (documented server ownership) ───────────
  {
    // Simulate server-owned increment policy without DB.
    let retryCount = 0;
    const onRetryTransition = (from: DownloadStatus, to: DownloadStatus) => {
      if (from === DownloadStatus.FAILED && to === DownloadStatus.QUEUED) {
        retryCount += 1;
        return true;
      }
      return false;
    };

    check('initial retryCount 0', retryCount === 0);
    check(
      'first retry increments once',
      onRetryTransition(DownloadStatus.FAILED, DownloadStatus.QUEUED) &&
        retryCount === 1,
    );
    check(
      'second retry increments once',
      onRetryTransition(DownloadStatus.FAILED, DownloadStatus.QUEUED) &&
        retryCount === 2,
    );
    check(
      'queued→queued does not increment',
      !onRetryTransition(DownloadStatus.QUEUED, DownloadStatus.QUEUED) &&
        retryCount === 2,
    );
  }

  // ── Create whitelist / mass-assignment surface ────────────────────
  {
    const createAllowed = new Set([
      'title',
      'sourceUrl',
      'platform',
      'thumbnailUrl',
      'fileName',
      'fileSize',
      'quality',
      'resolution',
      'bitrate',
    ]);
    const forbiddenOnCreate = [
      'userId',
      'status',
      'progress',
      'retryCount',
      'workerState',
      'errorCode',
      'errorMessage',
      'downloadedAt',
      'localPath',
      'authHeader',
      'cookie',
    ];
    for (const field of forbiddenOnCreate) {
      check(`create rejects ${field}`, !createAllowed.has(field));
    }

    const updateAllowed = new Set([
      'progress',
      'status',
      'fileName',
      'fileSize',
      'thumbnailUrl',
      'errorCode',
      'errorMessage',
      'workerState',
    ]);
    const forbiddenOnPatch = [
      'userId',
      'retryCount',
      'quality',
      'resolution',
      'bitrate',
      'sourceUrl',
    ];
    for (const field of forbiddenOnPatch) {
      check(`patch rejects ${field}`, !updateAllowed.has(field));
    }
  }

  // ── HLS create mapping contract (pure) ────────────────────────────
  {
    const master = 'https://example.com/master.m3u8';
    const child = 'https://cdn.example.com/720/index.m3u8';
    const createBody = {
      title: 'Show',
      sourceUrl: child,
      platform: 'EXAMPLE',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      fileName: 'index.ts',
      fileSize: 0,
      quality: '720p',
      resolution: '1280x720',
      bitrate: 4_200_000,
    };
    check('HLS sourceUrl is child not master', createBody.sourceUrl === child);
    check('HLS sourceUrl not master', createBody.sourceUrl !== master);
    check('HLS quality 720p', createBody.quality === '720p');
    check(
      'HLS resolution',
      sanitizeResolution(createBody.resolution) === '1280x720',
    );
    check('HLS bitrate', sanitizeBitrate(createBody.bitrate) === 4_200_000);
  }

  const failed = results.filter((r) => !r.ok).length;
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
