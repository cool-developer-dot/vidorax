import type { Request, Response } from 'express';
import { prisma } from '../database/index.js';

type HealthStatus = 'ok' | 'connected' | 'disconnected' | 'error';

interface HealthChecks {
  server: HealthStatus;
  prisma: HealthStatus;
  database: HealthStatus;
}

const checkDatabaseConnection = async (): Promise<HealthStatus> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch {
    return 'disconnected';
  }
};

export const getHealth = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const checks: HealthChecks = {
    server: 'ok',
    prisma: 'ok',
    database: await checkDatabaseConnection(),
  };

  const isHealthy = checks.database === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
  });
};
