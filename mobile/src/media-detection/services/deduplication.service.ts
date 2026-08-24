import type { DetectedMedia } from '../types';

/**
 * Merge an incoming detection into an existing list.
 * Matching id → update metadata (prefer non-null / higher confidence).
 */
export function dedupeUpsert(
  existing: DetectedMedia[],
  incoming: DetectedMedia,
  maxItems: number,
): { items: DetectedMedia[]; updated: boolean; inserted: boolean } {
  const index = existing.findIndex((item) => item.id === incoming.id);

  if (index >= 0) {
    const prev = existing[index]!;
    const merged = mergeMedia(prev, incoming);
    if (shallowEqualMedia(prev, merged)) {
      return { items: existing, updated: false, inserted: false };
    }
    const next = existing.slice();
    next[index] = merged;
    return { items: next, updated: true, inserted: false };
  }

  // Secondary dedup: same normalized URL + container → update instead of insert.
  const urlIndex = existing.findIndex(
    (item) =>
      item.url === incoming.url &&
      item.container === incoming.container &&
      item.category === incoming.category,
  );

  if (urlIndex >= 0) {
    const prev = existing[urlIndex]!;
    const merged = mergeMedia(prev, { ...incoming, id: prev.id });
    if (shallowEqualMedia(prev, merged)) {
      return { items: existing, updated: false, inserted: false };
    }
    const next = existing.slice();
    next[urlIndex] = merged;
    return { items: next, updated: true, inserted: false };
  }

  const next = [incoming, ...existing];
  if (next.length > maxItems) {
    next.length = maxItems;
  }
  return { items: next, updated: false, inserted: true };
}

function preferNullish<T>(prev: T | null, next: T | null): T | null {
  return next != null ? next : prev;
}

function mergeMedia(prev: DetectedMedia, incoming: DetectedMedia): DetectedMedia {
  return {
    ...prev,
    url: incoming.url || prev.url,
    pageUrl: incoming.pageUrl || prev.pageUrl,
    title: preferNullish(prev.title, incoming.title),
    thumbnailUrl: preferNullish(prev.thumbnailUrl, incoming.thumbnailUrl),
    duration: preferNullish(prev.duration, incoming.duration),
    width: preferNullish(prev.width, incoming.width),
    height: preferNullish(prev.height, incoming.height),
    resolution: preferNullish(prev.resolution, incoming.resolution),
    aspectRatio: preferNullish(prev.aspectRatio, incoming.aspectRatio),
    estimatedFileSize: preferNullish(
      prev.estimatedFileSize,
      incoming.estimatedFileSize,
    ),
    codec: preferNullish(prev.codec, incoming.codec),
    bitrate: preferNullish(prev.bitrate, incoming.bitrate),
    mimeType: preferNullish(prev.mimeType, incoming.mimeType),
    extension: preferNullish(prev.extension, incoming.extension),
    playlistType: preferNullish(prev.playlistType, incoming.playlistType),
    streamProtocol: preferNullish(prev.streamProtocol, incoming.streamProtocol),
    websiteSource: preferNullish(prev.websiteSource, incoming.websiteSource),
    platformHint: preferNullish(prev.platformHint, incoming.platformHint),
    isLive: prev.isLive || incoming.isLive,
    isDrm: prev.isDrm || incoming.isDrm,
    confidence: Math.max(prev.confidence, incoming.confidence),
    detectionSource: incoming.confidence >= prev.confidence
      ? incoming.detectionSource
      : prev.detectionSource,
    detectedAt: Math.max(prev.detectedAt, incoming.detectedAt),
  };
}

function shallowEqualMedia(a: DetectedMedia, b: DetectedMedia): boolean {
  return (
    a.title === b.title &&
    a.thumbnailUrl === b.thumbnailUrl &&
    a.duration === b.duration &&
    a.width === b.width &&
    a.height === b.height &&
    a.resolution === b.resolution &&
    a.estimatedFileSize === b.estimatedFileSize &&
    a.codec === b.codec &&
    a.bitrate === b.bitrate &&
    a.mimeType === b.mimeType &&
    a.confidence === b.confidence &&
    a.isLive === b.isLive &&
    a.isDrm === b.isDrm &&
    a.playlistType === b.playlistType
  );
}
