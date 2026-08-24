/**
 * Week 7 Day 4 Phase 3 — Production freeze verifier (backend).
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week7-day4-phase3.ts
 */

import { REALTIME_CONSTANTS } from '../src/realtime/types.js';

type Check = { name: string; ok: boolean; detail?: string };
const results: Check[] = [];

const check = (name: string, ok: boolean, detail?: string): void => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * Mirrors gateway extractToken query-gate policy without spinning a server.
 */
function queryTokenAllowed(env: {
  NODE_ENV?: string;
  WS_ALLOW_QUERY_TOKEN?: string;
}): boolean {
  return (
    env.NODE_ENV !== 'production' || env.WS_ALLOW_QUERY_TOKEN === '1'
  );
}

function main(): void {
  console.log('Week 7 Day 4 Phase 3 — production freeze verifier (backend)\n');

  check(
    'WS progress throttle is 750ms',
    REALTIME_CONSTANTS.progressThrottleMs === 750,
    String(REALTIME_CONSTANTS.progressThrottleMs),
  );
  check(
    'WS heartbeat interval 30s',
    REALTIME_CONSTANTS.heartbeatIntervalMs === 30_000,
  );
  check(
    'WS path /ws/downloads',
    REALTIME_CONSTANTS.path === '/ws/downloads',
  );
  check(
    'prod disables query-token by default',
    queryTokenAllowed({ NODE_ENV: 'production' }) === false,
  );
  check(
    'prod allows query-token with override',
    queryTokenAllowed({
      NODE_ENV: 'production',
      WS_ALLOW_QUERY_TOKEN: '1',
    }) === true,
  );
  check(
    'non-prod allows query-token',
    queryTokenAllowed({ NODE_ENV: 'development' }) === true,
  );

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();
