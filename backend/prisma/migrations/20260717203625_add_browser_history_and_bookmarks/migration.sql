-- CreateTable
CREATE TABLE "BrowserHistory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "faviconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrowserHistory_userId_idx" ON "BrowserHistory"("userId");

-- CreateIndex
CREATE INDEX "BrowserHistory_createdAt_idx" ON "BrowserHistory"("createdAt");

-- CreateIndex
CREATE INDEX "BrowserHistory_visitedAt_idx" ON "BrowserHistory"("visitedAt");

-- CreateIndex
CREATE INDEX "BrowserHistory_hostname_idx" ON "BrowserHistory"("hostname");

-- CreateIndex
CREATE INDEX "BrowserHistory_userId_visitedAt_idx" ON "BrowserHistory"("userId", "visitedAt");

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");

-- CreateIndex
CREATE INDEX "Bookmark_hostname_idx" ON "Bookmark"("hostname");

-- CreateIndex
CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_url_key" ON "Bookmark"("userId", "url");

-- AddForeignKey
ALTER TABLE "BrowserHistory" ADD CONSTRAINT "BrowserHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
