/**
 * Week 7 Day 4 Phase 2 — Security / SSRF / ownership hardening verifier (backend).
 *
 * Usage (from backend/):
 *   npx tsx scripts/verify-week7-day4-phase2.ts
 */

import {
  assertSafeAnalysisUrl,
  isPrivateOrLocalHostname,
  isPrivateOrLocalIp,
  isSafeAnalysisUrl,
  sanitizeUrlForLog,
  UnsafeUrlError,
} from '../src/utils/url-security.js';
import { assertSafeFileName } from '../src/domain/downloads/sanitize.js';
import {
  DOWNLOAD_STATUS_TRANSITIONS,
  assertDownloadTransition,
  isTerminalDownloadStatus,
} from '../src/domain/downloads/transitions.js';
import { DownloadStatus } from '@prisma/client';
import { AppError } from '../src/utils/errors/index.js';
import { REALTIME_CONSTANTS } from '../src/realtime/types.js';

type Check = { name: string; ok: boolean; detail?: string };
const results: Check[] = [];

const check = (name: string, ok: boolean, detail?: string): void => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

function main(): void {
  console.log('Week 7 Day 4 Phase 2 — hardening verifier (backend)\n');

  // ── SSRF hostname / mapped IPv6 ──────────────────────────────────
  check('block localhost', isPrivateOrLocalHostname('localhost'));
  check('block 127.0.0.1', isPrivateOrLocalHostname('127.0.0.1'));
  check('block ::1', isPrivateOrLocalHostname('::1'));
  check('block 10/8', isPrivateOrLocalHostname('10.1.2.3'));
  check('block 172.16/12', isPrivateOrLocalHostname('172.16.0.1'));
  check('block 192.168/16', isPrivateOrLocalHostname('192.168.0.1'));
  check('block link-local', isPrivateOrLocalHostname('169.254.169.254'));
  check('block CGNAT', isPrivateOrLocalHostname('100.64.0.1'));
  check('block metadata host', isPrivateOrLocalHostname('metadata.google.internal'));
  check(
    'block IPv4-mapped loopback',
    isPrivateOrLocalHostname('::ffff:127.0.0.1'),
  );
  check(
    'block IPv4-mapped metadata',
    isPrivateOrLocalHostname('::ffff:169.254.169.254'),
  );
  check(
    'isSafe rejects mapped loopback URL',
    !isSafeAnalysisUrl('http://[::ffff:127.0.0.1]/x'),
  );
  check(
    'isSafe rejects file scheme',
    !isSafeAnalysisUrl('file:///etc/passwd'),
  );
  check(
    'isSafe rejects ftp',
    !isSafeAnalysisUrl('ftp://cdn.example.com/x'),
  );
  check(
    'isSafe allows public https',
    isSafeAnalysisUrl('https://cdn.example.com/video.mp4'),
  );

  check('private IP 127', isPrivateOrLocalIp('127.0.0.1'));
  check('private IP metadata', isPrivateOrLocalIp('169.254.169.254'));
  check('public IP allowed', !isPrivateOrLocalIp('8.8.8.8'));

  try {
    assertSafeAnalysisUrl('http://127.0.0.1/x');
    check('assertSafe throws on loopback', false);
  } catch (error) {
    check('assertSafe throws on loopback', error instanceof UnsafeUrlError);
  }

  // ── Log redaction ────────────────────────────────────────────────
  {
    const sanitized = sanitizeUrlForLog(
      'https://cdn.example.com/v.mp4?token=SECRET&sig=ABC&x=1',
    );
    check('sanitize drops query secrets', !sanitized.includes('SECRET'));
    check('sanitize keeps origin path', sanitized.includes('cdn.example.com'));
  }

  // ── Filename ─────────────────────────────────────────────────────
  try {
    assertSafeFileName('../etc/passwd');
    check('filename blocks traversal', false);
  } catch (error) {
    check('filename blocks traversal', error instanceof AppError || error instanceof Error);
  }
  try {
    assertSafeFileName('ok-video.mp4');
    check('filename allows safe name', true);
  } catch {
    check('filename allows safe name', false);
  }

  // ── State machine terminals ──────────────────────────────────────
  check('COMPLETED terminal', isTerminalDownloadStatus(DownloadStatus.COMPLETED));
  check('CANCELLED terminal', isTerminalDownloadStatus(DownloadStatus.CANCELLED));
  check(
    'COMPLETED has no outbound transitions',
    DOWNLOAD_STATUS_TRANSITIONS.COMPLETED.length === 0,
  );
  check(
    'CANCELLED has no outbound transitions',
    DOWNLOAD_STATUS_TRANSITIONS.CANCELLED.length === 0,
  );
  try {
    assertDownloadTransition(DownloadStatus.CANCELLED, DownloadStatus.DOWNLOADING);
    check('CANCELLED→DOWNLOADING rejected', false);
  } catch (error) {
    check(
      'CANCELLED→DOWNLOADING rejected',
      error instanceof AppError && error.statusCode === 409,
    );
  }
  try {
    assertDownloadTransition(DownloadStatus.COMPLETED, DownloadStatus.QUEUED);
    check('COMPLETED→QUEUED rejected', false);
  } catch (error) {
    check(
      'COMPLETED→QUEUED rejected',
      error instanceof AppError && error.statusCode === 409,
    );
  }

  // ── WS path constant ─────────────────────────────────────────────
  check('ws path stable', REALTIME_CONSTANTS.path === '/ws/downloads');

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();
