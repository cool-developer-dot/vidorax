import type { DetectedMedia, MediaCandidate } from '../types';
import {
  buildMediaId,
  computeAspectRatio,
  derivePlatformHint,
  formatResolution,
  isSafeMediaUrl,
  normalizeMediaUrl,
  sanitizeFiniteNumber,
  scoreConfidence,
} from '../utils';
import {
  resolveCategory,
  resolveContainer,
  resolveExtension,
  resolveMimeType,
} from '../parsers';

/**
 * Enrich a validated candidate into DetectedMedia.
 * Missing fields stay null — never invent values.
 */
export function extractDetectedMedia(candidate: MediaCandidate): DetectedMedia | null {
  const extension =
    candidate.extension ?? resolveExtension(candidate.url, candidate.mimeType);
  const container = resolveContainer(extension);
  const category = resolveCategory(container, extension);
  if (!category) {
    return null;
  }

  const width = sanitizeFiniteNumber(candidate.width, { min: 1, max: 16_384 });
  const height = sanitizeFiniteNumber(candidate.height, { min: 1, max: 16_384 });
  const duration = sanitizeFiniteNumber(candidate.duration, { min: 0, max: 864_000 });
  const bitrate = sanitizeFiniteNumber(candidate.bitrate, { min: 1 });
  const estimatedFileSize = sanitizeFiniteNumber(candidate.estimatedFileSize, {
    min: 0,
  });

  const mimeType = resolveMimeType(extension, candidate.mimeType);
  const confidence = scoreConfidence(candidate);

  const id = buildMediaId({
    url: candidate.url,
    mimeType,
    container,
    width,
    height,
    bitrate,
    streamProtocol: candidate.streamProtocol,
    playlistType: candidate.playlistType,
  });

  const thumbnailUrl =
    candidate.thumbnailUrl && isSafeMediaUrl(candidate.thumbnailUrl)
      ? normalizeMediaUrl(candidate.thumbnailUrl)
      : null;

  return {
    id,
    url: candidate.url,
    pageUrl: candidate.pageUrl,
    title: candidate.title?.trim().slice(0, 255) || null,
    thumbnailUrl,
    duration,
    width,
    height,
    resolution: formatResolution(width, height),
    aspectRatio: computeAspectRatio(width, height),
    estimatedFileSize,
    codec: candidate.codec ?? null,
    bitrate,
    mimeType,
    extension,
    container,
    category,
    isLive: Boolean(candidate.isLive),
    isDrm: Boolean(candidate.isDrm),
    playlistType: candidate.playlistType ?? null,
    streamProtocol: candidate.streamProtocol ?? (category === 'stream' ? 'hls' : null),
    websiteSource: derivePlatformHint(candidate.pageUrl),
    detectionSource: candidate.detectionSource,
    detectedAt: Date.now(),
    confidence,
    platformHint: derivePlatformHint(candidate.pageUrl),
  };
}
