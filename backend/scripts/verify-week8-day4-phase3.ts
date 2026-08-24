/**
 * Week 8 Day 4 Phase 3 — release freeze contracts (backend).
 *
 * Static certification of production guards. Does not start a live server
 * (Day 4 Phase 2 already covers IDOR / DTO / query bounds over HTTP).
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week8-day4-phase3.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL  ${name}\n      ${message}`);
  }
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, acc);
      continue;
    }
    if (extname(entry) === '.ts' || extname(entry) === '.js') {
      acc.push(full);
    }
  }
  return acc;
}

function read(relFromBackend: string): string {
  return readFileSync(join(ROOT, relFromBackend), 'utf8');
}

await test('production rejects default JWT secrets and wildcard CORS', () => {
  const source = read('src/config/env.ts');
  assert(source.includes('INSECURE_JWT_DEFAULTS'), 'JWT default denylist missing');
  assert(source.includes("nodeEnv === 'production'"), 'production guard missing');
  assert(
    source.includes('must be set to strong, non-default values in production'),
    'JWT production error missing',
  );
  assert(
    source.includes('CORS_ORIGIN must be an explicit allowlist in production'),
    'CORS production error missing',
  );
  assert(source.includes("getEnv('PORT', '3105')"), 'PORT must be env-driven');
  assert(source.includes("getEnv('DATABASE_URL')"), 'DATABASE_URL is required');
});

await test('Prisma query logs are development-only; errors remain in production', () => {
  const source = read('src/database/prisma.ts');
  assert(source.includes("env.nodeEnv === 'development'"), 'dev log gate missing');
  assert(source.includes("? ['query', 'error', 'warn']"), 'dev query logs missing');
  assert(source.includes(": ['error']"), 'production must not enable query logs');
});

await test('startup PlaybackHistory probe and health endpoint exist', () => {
  const server = read('src/server.ts');
  const health = read('src/controllers/health.controller.ts');
  const routes = read('src/routes/index.ts');
  assert(
    server.includes('PlaybackHistory') && server.includes('clientRevision'),
    'startup DB probe missing',
  );
  assert(health.includes("prisma.$queryRaw`SELECT 1`"), 'health DB check missing');
  assert(routes.includes("router.use('/health'"), 'health route missing');
});

await test('request logger does not emit tokens, passwords, or file paths', () => {
  const source = read('src/middlewares/request-logger.middleware.ts');
  assert(source.includes('userId: req.user?.sub ?? null'), 'correlation userId expected');
  assert(!source.includes('authorization'), 'must not log Authorization');
  assert(!source.includes('password'), 'must not log password');
  assert(!source.includes('accessToken'), 'must not log accessToken');
});

await test('playback API rejects client-supplied localUri', () => {
  const source = read('src/validators/playback/playback.validator.ts');
  assert(source.includes("body('localUri')"), 'localUri validator missing');
  assert(source.includes('must not be supplied'), 'localUri must be rejected');
});

await test('WebSocket query-token fallback is off in production by default', () => {
  const source = read('src/realtime/gateway.ts');
  assert(
    source.includes("process.env.NODE_ENV !== 'production'") &&
      source.includes('WS_ALLOW_QUERY_TOKEN'),
    'query-token production gate missing',
  );
});

await test('no TODO/FIXME/HACK/TEMP release markers in production src', () => {
  const marker = /(?:^|\s)(?:\/\/|\/\*)\s*(TODO|FIXME|HACK|TEMP)\b/;
  const hits: string[] = [];
  for (const file of collectSourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      if (marker.test(line)) {
        hits.push(`${relative(SRC, file)}: ${line.trim()}`);
      }
    }
  }
  assert(hits.length === 0, hits.join('\n      '));
});

await test('production src is not driven by mock/fake/demo fixtures', () => {
  const banned = ['fakeHistory', 'mockPlayback', 'placeholder history', 'demo JWT'];
  const hits: string[] = [];
  for (const file of collectSourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    const lower = text.toLowerCase();
    for (const token of banned) {
      if (lower.includes(token.toLowerCase())) {
        hits.push(`${relative(SRC, file)} contains ${token}`);
      }
    }
  }
  assert(hits.length === 0, hits.join('\n      '));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
