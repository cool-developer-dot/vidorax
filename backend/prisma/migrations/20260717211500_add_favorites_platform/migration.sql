-- CreateEnum
CREATE TYPE "FavoritePlatform" AS ENUM (
  'YOUTUBE',
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
  'X',
  'VIMEO',
  'DAILYMOTION',
  'OTHER'
);

-- AlterTable
-- The temporary default safely backfills favorites created before Phase 4.
ALTER TABLE "Favorite"
ADD COLUMN "platform" "FavoritePlatform" NOT NULL DEFAULT 'OTHER';

ALTER TABLE "Favorite"
ALTER COLUMN "platform" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Favorite_userId_createdAt_idx"
ON "Favorite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Favorite_userId_platform_createdAt_idx"
ON "Favorite"("userId", "platform", "createdAt");
