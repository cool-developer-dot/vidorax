import type { Server } from 'node:http';
import app from './app.js';
import { env } from './config/index.js';
import { prisma } from './database/index.js';
import { attachRealtimeGateway, shutdownRealtimeGateway } from './realtime/index.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let isShuttingDown = false;

const disconnectPrisma = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('Prisma disconnected');
  } catch (error) {
    console.error('Error disconnecting Prisma:', error);
  }
};

const shutdown = (server: Server, signal: NodeJS.Signals): void => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Stop accepting WS clients and close sockets before HTTP drain.
  try {
    shutdownRealtimeGateway();
  } catch (error) {
    console.error('Error shutting down realtime gateway:', error);
  }

  server.close(async () => {
    clearTimeout(forceExitTimer);
    await disconnectPrisma();
    console.log('Server closed');
    process.exit(0);
  });
};

const startServer = async (): Promise<void> => {
  // Fail fast when generated Prisma client drifts from required playback fields.
  try {
    await prisma.$queryRaw`SELECT "clientRevision" FROM "PlaybackHistory" WHERE FALSE`;
  } catch (error) {
    console.error(
      'PlaybackHistory.clientRevision probe failed — run prisma migrate deploy && prisma generate, then restart.',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });

  attachRealtimeGateway(server);
  console.log('Realtime gateway attached at /ws/downloads');

  process.on('SIGTERM', () => shutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => shutdown(server, 'SIGINT'));
};

void startServer();
