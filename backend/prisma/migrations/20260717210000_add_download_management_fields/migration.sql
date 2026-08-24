-- AlterEnum
ALTER TYPE "DownloadStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "DownloadHistory"
ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "errorMessage" TEXT;

-- AddConstraint
ALTER TABLE "DownloadHistory"
ADD CONSTRAINT "DownloadHistory_progress_check"
CHECK ("progress" >= 0 AND "progress" <= 100);

ALTER TABLE "DownloadHistory"
ADD CONSTRAINT "DownloadHistory_fileSize_check"
CHECK ("fileSize" >= 0);

-- CreateIndex
CREATE INDEX "DownloadHistory_userId_status_createdAt_idx"
ON "DownloadHistory"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DownloadHistory_userId_platform_createdAt_idx"
ON "DownloadHistory"("userId", "platform", "createdAt");
