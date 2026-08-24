-- Week 8 Day 3 Phase 1 — durable PlaybackHistory (watch position / completion).
-- Preserves existing users and DownloadHistory rows. Does not alter download statuses.
-- FK policy: ON DELETE CASCADE from User and DownloadHistory — no orphan playback rows.

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlaybackHistory" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "mediaId" UUID NOT NULL,
  "positionSeconds" DOUBLE PRECISION NOT NULL,
  "durationSeconds" DOUBLE PRECISION NOT NULL,
  "progressPercent" DOUBLE PRECISION NOT NULL,
  "lastPlayedAt" TIMESTAMP(3),
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlaybackHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlaybackHistory_userId_mediaId_key"
  ON "PlaybackHistory"("userId", "mediaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlaybackHistory_userId_lastPlayedAt_idx"
  ON "PlaybackHistory"("userId", "lastPlayedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlaybackHistory_userId_completed_idx"
  ON "PlaybackHistory"("userId", "completed");

-- AddForeignKey
ALTER TABLE "PlaybackHistory"
  ADD CONSTRAINT "PlaybackHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackHistory"
  ADD CONSTRAINT "PlaybackHistory_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "DownloadHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
