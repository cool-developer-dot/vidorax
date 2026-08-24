-- Folder-filtered library queries: WHERE userId + COMPLETED + folderId
CREATE INDEX "DownloadHistory_userId_status_folderId_idx" ON "DownloadHistory"("userId", "status", "folderId");
