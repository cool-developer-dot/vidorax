/**
 * Canonical variant normalization pipeline:
 * label → stream flags → stable id → dedupe → deterministic order.
 */

import { createHash } from 'node:crypto';
import type {
  AnalysisUnsupportedReason,
  DownloadStreamType,
  MediaAnalysisVariant,
  MediaContainer,
} from '../../types/media-analysis.types.js';
import { isAudioOnlyCodecs, splitAndNormalizeCodecs } from './codecs.js';

export type VariantDraft = {
  sourceUrl: string;
  streamType: DownloadStreamType;
  resolution?: string | null;
  width?: number | null;
  height?: number | null;
  bitrate?: number | null;
  averageBitrate?: number | null;
  videoBitrate?: number | null;
  audioBitrate?: number | null;
  codecs?: string | null;
  container: MediaContainer;
  mimeType?: string | null;
  estimatedFileSize?: number | null;
  frameRate?: number | null;
  downloadable: boolean;
  unsupportedReason?: AnalysisUnsupportedReason | null;
  /** Stable original discovery order for tie-breaking. */
  originalIndex: number;
};

const MAX_ESTIMATED_BYTES = 50 * 1024 * 1024 * 1024; // 50 GiB sanity cap

export const formatResolution = (
  width: number | null | undefined,
  height: number | null | undefined,
): string | null => {
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return `${Math.trunc(width)}x${Math.trunc(height)}`;
};

/**
 * Labels are evidence-only.
 * Known height → "{height}p"
 * Otherwise → "Original Quality"
 */
export const buildQualityLabel = (input: {
  height?: number | null;
  width?: number | null;
  bitrate?: number | null;
  averageBitrate?: number | null;
  streamType: DownloadStreamType;
  container?: MediaContainer | null;
  isAudioOnly?: boolean;
}): string => {
  const height =
    typeof input.height === 'number' &&
    Number.isFinite(input.height) &&
    input.height > 0
      ? Math.trunc(input.height)
      : null;

  if (height != null) {
    return `${height}p`;
  }

  if (input.isAudioOnly || input.streamType === 'AUDIO') {
    if (input.container && input.container !== 'unknown' && input.container !== 'hls') {
      return input.container.toUpperCase();
    }
    return 'Original Quality';
  }

  return 'Original Quality';
};

export const deriveStreamFlags = (
  streamType: DownloadStreamType,
  isAudioOnly: boolean,
): {
  isHls: boolean;
  isProgressive: boolean;
  isAudioOnly: boolean;
} => ({
  isHls: streamType === 'HLS',
  isProgressive: streamType === 'PROGRESSIVE',
  isAudioOnly: isAudioOnly || streamType === 'AUDIO',
});

/**
 * Dedupe-only URL normalization. Preserves query (signed URLs).
 */
export const normalizeUrlForDedupe = (raw: string): string => {
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    if (
      (parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')
    ) {
      parsed.port = '';
    }

    return parsed.toString();
  } catch {
    return raw.trim();
  }
};

const buildDedupeKey = (variant: MediaAnalysisVariant): string => {
  return [
    normalizeUrlForDedupe(variant.sourceUrl),
    variant.streamType,
    variant.width ?? '',
    variant.height ?? '',
    variant.bitrate ?? '',
    variant.averageBitrate ?? '',
    variant.container,
  ].join('|');
};

export const buildVariantId = (variant: {
  sourceUrl: string;
  streamType: DownloadStreamType;
  width: number | null;
  height: number | null;
  bitrate: number | null;
  container: MediaContainer;
}): string => {
  const material = [
    normalizeUrlForDedupe(variant.sourceUrl),
    variant.streamType,
    variant.width ?? '',
    variant.height ?? '',
    variant.bitrate ?? '',
    variant.container,
  ].join('|');

  const digest = createHash('sha256').update(material).digest('hex').slice(0, 20);
  return `vq_${digest}`;
};

export const estimateHlsFileSizeBytes = (
  bitrateBps: number | null | undefined,
  durationSeconds: number | null | undefined,
): number | null => {
  if (
    typeof bitrateBps !== 'number' ||
    typeof durationSeconds !== 'number' ||
    !Number.isFinite(bitrateBps) ||
    !Number.isFinite(durationSeconds) ||
    bitrateBps <= 0 ||
    durationSeconds <= 0
  ) {
    return null;
  }

  const bytes = Math.round((bitrateBps * durationSeconds) / 8);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_ESTIMATED_BYTES) {
    return null;
  }
  return bytes;
};

export const contentLengthToEstimatedSize = (
  contentLength: string | null | undefined,
): number | null => {
  if (!contentLength || !/^\d+$/.test(contentLength.trim())) {
    return null;
  }
  try {
    const value = BigInt(contentLength.trim());
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    const asNumber = Number(value);
    return asNumber >= 0 ? asNumber : null;
  } catch {
    return null;
  }
};

export const finalizeVariant = (draft: VariantDraft): MediaAnalysisVariant => {
  const width =
    typeof draft.width === 'number' &&
    Number.isFinite(draft.width) &&
    draft.width > 0
      ? Math.trunc(draft.width)
      : null;
  const height =
    typeof draft.height === 'number' &&
    Number.isFinite(draft.height) &&
    draft.height > 0
      ? Math.trunc(draft.height)
      : null;

  const codecs = draft.codecs?.trim() || null;
  const split = splitAndNormalizeCodecs(codecs);
  const audioOnly =
    draft.streamType === 'AUDIO' || isAudioOnlyCodecs(codecs);

  // Preserve HLS as HLS even for audio-only renditions.
  // Progressive audio uses AUDIO; other drafts keep their declared type.
  const streamType: DownloadStreamType =
    draft.streamType === 'PROGRESSIVE' && audioOnly
      ? 'AUDIO'
      : draft.streamType;

  const resolution =
    draft.resolution?.trim() || formatResolution(width, height);

  const bitrate =
    typeof draft.bitrate === 'number' &&
    Number.isFinite(draft.bitrate) &&
    draft.bitrate > 0
      ? Math.trunc(draft.bitrate)
      : null;
  const averageBitrate =
    typeof draft.averageBitrate === 'number' &&
    Number.isFinite(draft.averageBitrate) &&
    draft.averageBitrate > 0
      ? Math.trunc(draft.averageBitrate)
      : null;

  const estimatedFileSize =
    typeof draft.estimatedFileSize === 'number' &&
    Number.isFinite(draft.estimatedFileSize) &&
    draft.estimatedFileSize >= 0
      ? Math.trunc(draft.estimatedFileSize)
      : null;

  const frameRate =
    typeof draft.frameRate === 'number' &&
    Number.isFinite(draft.frameRate) &&
    draft.frameRate > 0
      ? draft.frameRate
      : null;

  const label = buildQualityLabel({
    height,
    width,
    bitrate,
    averageBitrate,
    streamType,
    container: draft.container,
    isAudioOnly: audioOnly,
  });

  const base = {
    sourceUrl: draft.sourceUrl,
    streamType,
    width,
    height,
    bitrate,
    container: draft.container,
  };

  return {
    id: buildVariantId(base),
    sourceUrl: draft.sourceUrl,
    streamType,
    label,
    resolution,
    width,
    height,
    bitrate,
    averageBitrate,
    videoBitrate:
      typeof draft.videoBitrate === 'number' && draft.videoBitrate > 0
        ? Math.trunc(draft.videoBitrate)
        : null,
    audioBitrate:
      typeof draft.audioBitrate === 'number' && draft.audioBitrate > 0
        ? Math.trunc(draft.audioBitrate)
        : null,
    codecs: split.raw,
    videoCodec: split.videoCodec,
    audioCodec: split.audioCodec,
    container: draft.container,
    mimeType: draft.mimeType ?? null,
    estimatedFileSize,
    frameRate,
    downloadable: draft.downloadable === true,
    unsupportedReason: draft.downloadable
      ? null
      : (draft.unsupportedReason ?? 'UNSUPPORTED_STREAM'),
  };
};

/**
 * Safe dedupe: identical URL + stream + dimensions + bitrate + container collapse.
 * Different URLs with same resolution are preserved.
 */
export const dedupeVariants = (
  variants: MediaAnalysisVariant[],
): MediaAnalysisVariant[] => {
  const seen = new Set<string>();
  const result: MediaAnalysisVariant[] = [];

  for (const variant of variants) {
    const key = buildDedupeKey(variant);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(variant);
  }

  return result;
};

const effectiveBitrate = (variant: MediaAnalysisVariant): number =>
  variant.averageBitrate ?? variant.bitrate ?? -1;

const isAudioOnlyVariant = (variant: MediaAnalysisVariant): boolean =>
  variant.streamType === 'AUDIO' ||
  (variant.videoCodec == null &&
    variant.audioCodec != null &&
    variant.height == null);

/**
 * Deterministic ordering:
 * 1. Video (non-audio-only) before audio-only
 * 2. Known height desc
 * 3. Known width desc
 * 4. Effective bitrate desc
 * 5. Original array order as stable tie-breaker
 *
 * Unknown-resolution variants sort below known-resolution peers in the same group.
 */
export const sortVariants = (
  variants: MediaAnalysisVariant[],
): MediaAnalysisVariant[] => {
  return variants
    .map((variant, index) => ({ variant, index }))
    .sort((a, b) => {
      const audioA = isAudioOnlyVariant(a.variant) ? 1 : 0;
      const audioB = isAudioOnlyVariant(b.variant) ? 1 : 0;
      if (audioA !== audioB) {
        return audioA - audioB;
      }

      const heightA = a.variant.height;
      const heightB = b.variant.height;
      const knownHeightA = heightA != null ? 1 : 0;
      const knownHeightB = heightB != null ? 1 : 0;
      if (knownHeightA !== knownHeightB) {
        return knownHeightB - knownHeightA;
      }
      if (heightA != null && heightB != null && heightA !== heightB) {
        return heightB - heightA;
      }

      const widthA = a.variant.width;
      const widthB = b.variant.width;
      const knownWidthA = widthA != null ? 1 : 0;
      const knownWidthB = widthB != null ? 1 : 0;
      if (knownWidthA !== knownWidthB) {
        return knownWidthB - knownWidthA;
      }
      if (widthA != null && widthB != null && widthA !== widthB) {
        return widthB - widthA;
      }

      const brA = effectiveBitrate(a.variant);
      const brB = effectiveBitrate(b.variant);
      if (brA !== brB) {
        return brB - brA;
      }

      return a.index - b.index;
    })
    .map((entry) => entry.variant);
};

export const canonicalizeVariants = (
  drafts: VariantDraft[],
): MediaAnalysisVariant[] => {
  const finalized = drafts.map((draft) => finalizeVariant(draft));
  return sortVariants(dedupeVariants(finalized));
};

/** Pick primary summary variant: first after canonical sort (highest video). */
export const pickPrimaryVariant = (
  variants: MediaAnalysisVariant[],
): MediaAnalysisVariant | null => variants[0] ?? null;
