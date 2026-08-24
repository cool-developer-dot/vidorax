-- Week 8 Day 1 Phase 2 — logical media folders + durable folderId on completed media.

-- CreateTable
CREATE TABLE IF NOT EXISTS "MediaFolder" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaFolder_userId_idx" ON "MediaFolder"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaFolder_createdAt_idx" ON "MediaFolder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MediaFolder_userId_normalizedName_key"
  ON "MediaFolder"("userId", "normalizedName");

-- AlterTable
ALTER TABLE "DownloadHistory"
  ADD COLUMN IF NOT EXISTS "folderId" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DownloadHistory_folderId_idx" ON "DownloadHistory"("folderId");

-- AddForeignKey
ALTER TABLE "MediaFolder"
  ADD CONSTRAINT "MediaFolder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadHistory"
  ADD CONSTRAINT "DownloadHistory_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

