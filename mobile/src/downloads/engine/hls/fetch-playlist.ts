/**
 * Safe HLS playlist HTTP fetch — SSRF + size bounded.
 */

import { DownloadEngineError } from '../errors';
import { isSafeHttpUrl } from '../resource-guard';
import { HLS_TRANSFER } from './constants';
import { parseHlsPlaylist, type HlsResolvedPlaylist } from './playlist';

export async function fetchAndParseHlsPlaylist(
  url: string,
  signal: AbortSignal,
): Promise<{ playlist: HlsResolvedPlaylist; finalUrl: string }> {
  if (!isSafeHttpUrl(url)) {
    throw new DownloadEngineError('INVALID_RESOURCE', 'Invalid HLS URL.');
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  const timeout = setTimeout(
    () => controller.abort(),
    HLS_TRANSFER.requestTimeoutMs,
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept:
          'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain, */*',
      },
      signal: controller.signal,
    });

    if (signal.aborted || controller.signal.aborted) {
      throw new DownloadEngineError('CANCELLED', 'Download cancelled.');
    }

    if (response.status === 404) {
      throw new DownloadEngineError(
        'INVALID_HLS_PLAYLIST',
        'The HLS playlist could not be found.',
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new DownloadEngineError(
        'AUTH_ERROR',
        'Authentication is required to download this stream.',
      );
    }
    if (response.status === 408 || response.status === 429) {
      throw new DownloadEngineError('HTTP_ERROR', `HTTP ${response.status}`);
    }
    if (response.status >= 500) {
      throw new DownloadEngineError('HTTP_ERROR', `HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new DownloadEngineError('HTTP_ERROR', `HTTP ${response.status}`);
    }

    const finalUrl = response.url || url;
    if (!isSafeHttpUrl(finalUrl)) {
      throw new DownloadEngineError(
        'INVALID_RESOURCE',
        'HLS redirect failed security checks.',
      );
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (
      Number.isFinite(contentLength) &&
      contentLength > HLS_TRANSFER.maxPlaylistBytes
    ) {
      throw new DownloadEngineError(
        'INVALID_HLS_PLAYLIST',
        'HLS playlist exceeds the supported size.',
      );
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new DownloadEngineError('INVALID_HLS_PLAYLIST', 'Empty HLS playlist.');
    }
    if (text.length > HLS_TRANSFER.maxPlaylistBytes) {
      throw new DownloadEngineError(
        'INVALID_HLS_PLAYLIST',
        'HLS playlist exceeds the supported size.',
      );
    }

    const playlist = parseHlsPlaylist(text, finalUrl);
    return { playlist, finalUrl };
  } catch (error) {
    if (error instanceof DownloadEngineError) {
      throw error;
    }
    if (
      signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new DownloadEngineError('CANCELLED', 'Download cancelled.');
    }
    throw new DownloadEngineError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch HLS playlist.',
    );
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', onAbort);
  }
}
