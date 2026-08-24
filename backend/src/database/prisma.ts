import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../config/index.js';

/**
 * Bump when PlaybackHistory (or other hot-path) Prisma select shapes change.
 * Prevents tsx/dev globalThis cache from keeping a pre-generate PrismaClient
 * that rejects new fields (e.g. clientRevision → unexplained HTTP 500).
 */
const PRISMA_CLIENT_EPOCH = '20260822160000_playback_client_revision';

type TaggedPrismaClient = PrismaClient & { __vidoraxEpoch?: string };

const globalForPrisma = globalThis as unknown as {
  prisma: TaggedPrismaClient | undefined;
};

function assertGeneratedClientSupportsPlaybackRevision(): void {
  const model = Prisma.dmmf.datamodel.models.find(
    (entry) => entry.name === 'PlaybackHistory',
  );
  const hasRevision = Boolean(
    model?.fields.some((field) => field.name === 'clientRevision'),
  );
  if (!hasRevision) {
    throw new Error(
      'Prisma client is out of date (PlaybackHistory.clientRevision missing). Run: npx prisma generate',
    );
  }
}

function createPrismaClient(): TaggedPrismaClient {
  assertGeneratedClientSupportsPlaybackRevision();
  const client = new PrismaClient({
    log:
      env.nodeEnv === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  }) as TaggedPrismaClient;
  client.__vidoraxEpoch = PRISMA_CLIENT_EPOCH;
  return client;
}

function resolvePrismaClient(): TaggedPrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing?.__vidoraxEpoch === PRISMA_CLIENT_EPOCH) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }
  const next = createPrismaClient();
  if (env.nodeEnv !== 'production') {
    globalForPrisma.prisma = next;
  }
  return next;
}

export const prisma = resolvePrismaClient();
