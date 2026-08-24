/**
 * Server-side URL security for media analysis.
 * Ported from mobile media-detection SSRF/scheme guards — do not weaken.
 */

import { lookup } from 'node:dns/promises';
import {
  isPrivateOrLocalHostname,
  isPrivateOrLocalIp,
  type PrivateHostOptions,
} from './private-host.js';

export const BLOCKED_URL_SCHEMES = [
  'javascript:',
  'blob:',
  'file:',
  'data:',
  'about:',
  'chrome:',
  'chrome-extension:',
  'vidorax:',
  'intent:',
  'market:',
  'content:',
  'ftp:',
  'gopher:',
] as const;

export const ALLOWED_URL_SCHEMES = ['http:', 'https:'] as const;

export class UnsafeUrlError extends Error {
  constructor(message = 'URL is unsafe or unsupported') {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export type UrlSecurityOptions = PrivateHostOptions;

export { isPrivateOrLocalHostname, isPrivateOrLocalIp };

export const isSafeAnalysisUrl = (
  raw: string | null | undefined,
  options: UrlSecurityOptions = {},
): boolean => {
  if (!raw || typeof raw !== 'string') {
    return false;
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 8_192) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (
    (BLOCKED_URL_SCHEMES as readonly string[]).some((scheme) =>
      lower.startsWith(scheme),
    )
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (!(ALLOWED_URL_SCHEMES as readonly string[]).includes(protocol)) {
      return false;
    }
    if (!parsed.hostname) {
      return false;
    }
    if (isPrivateOrLocalHostname(parsed.hostname, options)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const assertSafeAnalysisUrl = (
  raw: string,
  options: UrlSecurityOptions = {},
): URL => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new UnsafeUrlError('URL is required');
  }

  const lower = trimmed.toLowerCase();
  if (
    (BLOCKED_URL_SCHEMES as readonly string[]).some((scheme) =>
      lower.startsWith(scheme),
    )
  ) {
    throw new UnsafeUrlError('URL scheme is not allowed');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UnsafeUrlError('URL is malformed');
  }

  if (!(ALLOWED_URL_SCHEMES as readonly string[]).includes(parsed.protocol)) {
    throw new UnsafeUrlError('URL must use http or https');
  }

  if (!parsed.hostname) {
    throw new UnsafeUrlError('URL hostname is invalid');
  }

  if (isPrivateOrLocalHostname(parsed.hostname, options)) {
    throw new UnsafeUrlError('URL targets a private or local host');
  }

  return parsed;
};

/**
 * Hostname text check + DNS resolution of all A/AAAA records.
 * Blocks DNS rebinding to private / metadata addresses.
 */
export const assertSafeAnalysisUrlResolved = async (
  raw: string,
  options: UrlSecurityOptions = {},
): Promise<URL> => {
  const parsed = assertSafeAnalysisUrl(raw, options);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  // Literal IPv4 / IPv6 already validated by assertSafeAnalysisUrl — skip DNS.
  if (
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(':')
  ) {
    return parsed;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('URL hostname could not be resolved');
  }

  if (!addresses.length) {
    throw new UnsafeUrlError('URL hostname could not be resolved');
  }

  for (const entry of addresses) {
    if (isPrivateOrLocalIp(entry.address, options)) {
      throw new UnsafeUrlError('URL resolves to a private or local address');
    }
  }

  return parsed;
};

/** Prefer hostname + pathname for production logs (no query secrets). */
export const sanitizeUrlForLog = (raw: string): string => {
  try {
    const parsed = new URL(raw);
    parsed.username = '';
    parsed.password = '';

    const sensitiveKeys = [
      'token',
      'access_token',
      'refresh_token',
      'auth',
      'authorization',
      'signature',
      'sig',
      'key',
      'api_key',
      'apikey',
      'password',
      'secret',
      'expires',
      'x-amz-signature',
      'x-amz-credential',
      'x-amz-security-token',
    ];

    let redactedQuery = false;
    for (const key of [...parsed.searchParams.keys()]) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, 'REDACTED');
        redactedQuery = true;
      }
    }

    // If any sensitive token was present, drop the remaining query entirely.
    if (redactedQuery || parsed.searchParams.size > 0) {
      return `${parsed.origin}${parsed.pathname}`;
    }

    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[invalid-url]';
  }
};
