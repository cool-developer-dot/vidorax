-- AlterTable
ALTER TABLE "DownloadHistory" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;

-- Constrain stable error codes when present (uppercase identifier).
ALTER TABLE "DownloadHistory"
DROP CONSTRAINT IF EXISTS "DownloadHistory_errorCode_check";

ALTER TABLE "DownloadHistory"
ADD CONSTRAINT "DownloadHistory_errorCode_check"
CHECK (
  "errorCode" IS NULL
  OR "errorCode" ~ '^[A-Z][A-Z0-9_]{0,63}$'
);
