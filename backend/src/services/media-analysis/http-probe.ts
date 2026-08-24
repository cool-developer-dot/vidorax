/**
 * Bounded HTTP inspection for media analysis.
 * Follows redirects manually so every hop is security-validated.
 * Never buffers full media files.
 */

import {
  assertSafeAnalysisUrlResolved,
  UnsafeUrlError,
  type UrlSecurityOptions,
} from '../../utils/url-security.js';

export const ANALYSIS_TIMEOUT_MS = Number(
  process.env.MEDIA_ANALYSIS_TIMEOUT_MS ?? 10_000,
);
export const ANALYSIS_MAX_REDIRECTS = 5;
export const ANALYSIS_MAX_MANIFEST_BYTES = 512_000;
export const ANALYSIS_MAX_PROBE_BYTES = 16_384;
/** Hard cap on HLS master variants returned from Analyze. */
export const ANALYSIS_MAX_HLS_VARIANTS = 64;

export type ProbeHeaders = {
  contentType: string | null;
  contentLength: string | null;
  contentDisposition: string | null;
  acceptRanges: string | null;
};

export type HttpProbeResult = {
  finalUrl: string;
  status: number;
  headers: ProbeHeaders;
  /** Small body sample when intentionally fetched (manifest / sniff). */
  bodyText: string | null;
};

export class AnalysisNetworkError extends Error {
  readonly kind: 'timeout' | 'unreachable' | 'http' | 'redirect' | 'aborted';

  constructor(
    kind: AnalysisNetworkError['kind'],
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AnalysisNetworkError';
    this.kind = kind;
  }
}

const readHeaders = (headers: Headers): ProbeHeaders => ({
  contentType: headers.get('content-type'),
  contentLength: headers.get('content-length'),
  contentDisposition: headers.get('content-disposition'),
  acceptRanges: headers.get('accept-ranges'),
});

const withTimeout = async <T>(
  factory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await factory(controller.signal);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || controller.signal.aborted)
    ) {
      throw new AnalysisNetworkError('timeout', 'Analysis request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const resolveRedirectUrl = (location: string, currentUrl: string): string => {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    throw new AnalysisNetworkError(
      'redirect',
      'Redirect location is malformed',
    );
  }
};

/**
 * Follow redirects manually, validating each hop against URL security rules.
 */
export const followRedirects = async (
  startUrl: string,
  init: {
    method: 'HEAD' | 'GET';
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
    readBody?: boolean;
    maxBodyBytes?: number;
    security?: UrlSecurityOptions;
  },
): Promise<HttpProbeResult> => {
  const timeoutMs = init.timeoutMs ?? ANALYSIS_TIMEOUT_MS;
  const maxRedirects = init.maxRedirects ?? ANALYSIS_MAX_REDIRECTS;
  const security = init.security ?? {};
  // Resolve+validate start URL (DNS rebinding defense).
  let currentUrl = (
    await assertSafeAnalysisUrlResolved(startUrl, security)
  ).toString();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    // Re-resolve every hop — do not trust hostname text alone.
    currentUrl = (
      await assertSafeAnalysisUrlResolved(currentUrl, security)
    ).toString();

    let response: Response;
    try {
      response = await withTimeout(
        (signal) =>
          fetch(currentUrl, {
            method: init.method,
            redirect: 'manual',
            signal,
            headers: {
              accept: '*/*',
              'user-agent': 'VidoraX-MediaAnalysis/1.0',
              ...init.headers,
            },
          }),
        timeoutMs,
      );
    } catch (error) {
      if (error instanceof AnalysisNetworkError) {
        throw error;
      }
      if (error instanceof UnsafeUrlError) {
        throw error;
      }
      throw new AnalysisNetworkError(
        'unreachable',
        'Source host is unreachable',
      );
    }

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has('location')
    ) {
      // Drain/cancel unused body before hopping.
      try {
        await response.body?.cancel();
      } catch {
        // ignore cancel failures
      }

      if (hop === maxRedirects) {
        throw new AnalysisNetworkError(
          'redirect',
          'Too many redirects while analyzing URL',
        );
      }

      const location = response.headers.get('location');
      if (!location) {
        throw new AnalysisNetworkError(
          'redirect',
          'Redirect is missing a location',
        );
      }

      currentUrl = resolveRedirectUrl(location, currentUrl);
      continue;
    }

    let bodyText: string | null = null;
    if (init.readBody && init.method === 'GET') {
      bodyText = await readBoundedText(
        response,
        init.maxBodyBytes ?? ANALYSIS_MAX_PROBE_BYTES,
      );
    } else {
      try {
        await response.body?.cancel();
      } catch {
        // ignore
      }
    }

    return {
      finalUrl: currentUrl,
      status: response.status,
      headers: readHeaders(response.headers),
      bodyText,
    };
  }

  throw new AnalysisNetworkError(
    'redirect',
    'Too many redirects while analyzing URL',
  );
};

const readBoundedText = async (
  response: Response,
  maxBytes: number,
): Promise<string> => {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      const remaining = maxBytes - total;
      if (value.byteLength <= remaining) {
        chunks.push(value);
        total += value.byteLength;
      } else {
        chunks.push(value.slice(0, remaining));
        total += remaining;
        break;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
};

/**
 * Lightweight source inspection: prefer HEAD, fall back to ranged GET.
 */
export const inspectSource = async (
  url: string,
  security: UrlSecurityOptions = {},
): Promise<HttpProbeResult> => {
  try {
    const head = await followRedirects(url, { method: 'HEAD', security });
    if (head.status !== 405 && head.status !== 501) {
      return head;
    }
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw error;
    }
    // Fall through to ranged GET for hosts that reject HEAD.
  }

  return followRedirects(url, {
    method: 'GET',
    headers: { range: 'bytes=0-0' },
    readBody: false,
    security,
  });
};

export const fetchBoundedText = async (
  url: string,
  maxBytes: number = ANALYSIS_MAX_MANIFEST_BYTES,
  security: UrlSecurityOptions = {},
): Promise<HttpProbeResult> => {
  return followRedirects(url, {
    method: 'GET',
    readBody: true,
    maxBodyBytes: maxBytes ?? ANALYSIS_MAX_MANIFEST_BYTES,
    security,
  });
};
