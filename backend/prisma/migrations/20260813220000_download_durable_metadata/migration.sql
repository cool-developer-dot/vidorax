-- Week 7 Day 1 Phase 3 — additive durable download metadata + worker state.
-- No destructive resets. Existing rows remain valid.

-- CreateEnum
CREATE TYPE "DownloadWorkerState" AS ENUM (
  'IDLE',
  'WAITING',
  'STARTING',
  'TRANSFERRING',
  'PAUSING',
  'PAUSED',
  'RETRY_WAIT',
  'VERIFYING',
  'COMPLETING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

-- AlterTable
ALTER TABLE "DownloadHistory"
  ADD COLUMN IF NOT EXISTS "quality" TEXT,
  ADD COLUMN IF NOT EXISTS "resolution" TEXT,
  ADD COLUMN IF NOT EXISTS "bitrate" INTEGER,
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "workerState" "DownloadWorkerState";

-- quality: bounded length when present
ALTER TABLE "DownloadHistory"
DROP CONSTRAINT IF EXISTS "DownloadHistory_quality_check";

ALTER TABLE "DownloadHistory"
ADD CONSTRAINT "DownloadHistory_quality_check"
CHECK (
  "quality" IS NULL
  OR char_length("quality") BETWEEN 1 AND 64
);

-- resolution: WIDTHxHEIGHT when present (never 0x0 / unknown literals)
ALTER TABLE "DownloadHistory"
DROP CONSTRAINT IF EXISTS "DownloadHistory_resolution_check";

ALTER TABLE "DownloadHistory"
ADD CONSTRAINT "DownloadHistory_resolution_check"
CHECK (
  "resolution" IS NULL
  OR "resolution" ~ '^[1-9][0-9]{1,4}x[1-9][0-9]{1,4}$'
);

-- bitrate: positive when present (0 is never used for unknown)
ALTER TABLE "DownloadHistory"
DROP CONSTRAINT IF EXISTS "DownloadHistory_bitrate_check";

ALTER TABLE "DownloadHistory"
ADD CONSTRAINT "DownloadHistory_bitrate_check"
CHECK (
  "bitrate" IS NULL
  OR ("bitrate" > 0 AND "bitrate" <= 2000000000)
);

-- retryCount: non-negative
ALTER TABLE "DownloadHistory"
DROP CONSTRAINT IF EXISTS "DownloadHistory_retryCount_check";

ALTER TABLE "DownloadHistory"
ADD CONSTRAINT "DownloadHistory_retryCount_check"
CHECK ("retryCount" >= 0);

-- Historical workerState mapping (correctness over cosmetic completeness):
-- DOWNLOADING left NULL — may be interrupted sessions, not live TRANSFERRING.
UPDATE "DownloadHistory"
SET "workerState" = 'WAITING'
WHERE "status" = 'QUEUED' AND "workerState" IS NULL;

UPDATE "DownloadHistory"
SET "workerState" = 'PAUSED'
WHERE "status" = 'PAUSED' AND "workerState" IS NULL;

UPDATE "DownloadHistory"
SET "workerState" = 'COMPLETED'
WHERE "status" = 'COMPLETED' AND "workerState" IS NULL;

UPDATE "DownloadHistory"
SET "workerState" = 'FAILED'
WHERE "status" = 'FAILED' AND "workerState" IS NULL;

UPDATE "DownloadHistory"
SET "workerState" = 'CANCELLED'
WHERE "status" = 'CANCELLED' AND "workerState" IS NULL;
