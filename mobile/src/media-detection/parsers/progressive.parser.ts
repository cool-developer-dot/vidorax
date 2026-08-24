import type { MediaCandidate } from '../types';
import { isSafeMediaUrl, normalizeMediaUrl } from '../utils';
import {
  isSupportedMediaUrl,
  resolveCategory,
  resolveContainer,
  resolveExtension,
  resolveMimeType,
} from './extension.parser';

/**
 * Classify a progressive (or stream URL by extension) network resource.
 */
export function parseProgressiveMediaUrl(input: {
  url: string;
  pageUrl: string;
  mimeType?: string | null;
  detectionSource: MediaCandidate['detectionSource'];
  title?: string | null;
  estimatedFileSize?: number | null;
}): MediaCandidate | null {
  const url = normalizeMediaUrl(input.url);
  const pageUrl = normalizeMediaUrl(input.pageUrl);

  if (!url || !pageUrl || !isSafeMediaUrl(url) || !isSafeMediaUrl(pageUrl)) {
    return null;
  }

  if (!isSupportedMediaUrl(url, input.mimeType)) {
    return null;
  }

  const extension = resolveExtension(url, input.mimeType);
  const container = resolveContainer(extension);
  const category = resolveCategory(container, extension);
  if (!category) {
    return null;
  }

  return {
    url,
    pageUrl,
    mimeType: resolveMimeType(extension, input.mimeType),
    extension,
    title: input.title ?? null,
    estimatedFileSize: input.estimatedFileSize ?? null,
    detectionSource: input.detectionSource,
    streamProtocol: category === 'stream' ? 'hls' : null,
    playlistType: category === 'stream' ? 'unknown' : null,
    isLive: false,
    isDrm: false,
  };
}
