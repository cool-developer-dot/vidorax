/**
 * Shared IP / hostname privacy checks for SSRF defense.
 * Used by hostname string checks and post-DNS resolution validation.
 */

export type PrivateHostOptions = {
  allowLoopback?: boolean;
};

const METADATA_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

/** Extract IPv4 from dotted quad or IPv4-mapped IPv6 (::ffff:a.b.c.d / ::ffff:hex). */
export function extractIpv4(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');

  const dotted = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (dotted) {
    return host;
  }

  const mappedDotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(
    host,
  );
  if (mappedDotted?.[1]) {
    return mappedDotted[1];
  }

  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (mappedHex) {
    const hi = Number.parseInt(mappedHex[1]!, 16);
    const lo = Number.parseInt(mappedHex[2]!, 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) {
      return null;
    }
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }

  return null;
}

export function isPrivateIpv4(
  ip: string,
  options: PrivateHostOptions = {},
): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];

  if (a === 127) {
    return options.allowLoopback !== true;
  }
  if (a === 10) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function isPrivateIpv6(
  host: string,
  options: PrivateHostOptions = {},
): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');

  if (h === '::1' || h === '::') {
    return options.allowLoopback !== true;
  }

  // IPv4-mapped handled via extractIpv4 by caller.
  if (
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80') ||
    h.startsWith('fec0') ||
    h === '::ffff:0:0' ||
    h.startsWith('100::') // discard-only / discard prefix adjacent
  ) {
    return true;
  }

  return false;
}

/**
 * True when hostname text or literal IP targets private/local/metadata space.
 * Callers that resolve DNS must also validate each resolved address.
 */
export function isPrivateOrLocalHostname(
  hostname: string,
  options: PrivateHostOptions = {},
): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');

  if (METADATA_HOSTNAMES.has(host) || host.endsWith('.internal')) {
    return true;
  }

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    return options.allowLoopback !== true;
  }

  const ipv4 = extractIpv4(host);
  if (ipv4) {
    return isPrivateIpv4(ipv4, options);
  }

  if (host.includes(':')) {
    return isPrivateIpv6(host, options);
  }

  if (host === '0.0.0.0') {
    return true;
  }

  return false;
}

/** Validate a resolved IP address string (A / AAAA). */
export function isPrivateOrLocalIp(
  address: string,
  options: PrivateHostOptions = {},
): boolean {
  const host = address.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const ipv4 = extractIpv4(host);
  if (ipv4) {
    return isPrivateIpv4(ipv4, options);
  }
  if (host.includes(':')) {
    return isPrivateIpv6(host, options);
  }
  return true;
}
