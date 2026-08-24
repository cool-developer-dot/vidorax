import { DETECTION_TIMING } from '../constants';
import { parseHlsManifest } from '../parsers';
import { isSafeMediaUrl } from '../utils';

/**
 * Fetch an HLS manifest from React Native (no CORS).
 * Bounded by timeout and max bytes. Never follows unsafe redirects by re-validating URL.
 */
export async function fetchHlsManifestText(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!isSafeMediaUrl(url)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    DETECTION_TIMING.manifestFetchTimeoutMs,
  );

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain, */*',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const finalUrl = response.url || url;
    if (!isSafeMediaUrl(finalUrl)) {
      return null;
    }

    const text = await response.text();
    if (!text || text.length > DETECTION_TIMING.manifestMaxBytes) {
      return null;
    }

    // Quick sanity — must look like HLS before full parse.
    if (!text.trimStart().startsWith('#EXTM3U')) {
      return null;
    }

    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function enrichHlsFromUrl(url: string, signal?: AbortSignal) {
  const text = await fetchHlsManifestText(url, signal);
  if (!text) {
    return null;
  }
  return parseHlsManifest(text, url);
}
