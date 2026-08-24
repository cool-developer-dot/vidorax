/**
 * Map a selected quality option back to the create-download contract.
 * Durable subset (quality / resolution / bitrate) reaches POST /downloads;
 * the full analyzer object stays analysis-time only.
 */

import type { AnalyzedMediaSelection, DownloadQualityOption, QualityOption } from './types';

/** Selected variant metadata preserved through local create mapping. */
export type SelectedQualityMetadata = {
  id: string;
  label: string;
  sourceUrl: string;
  resolution: string | null;
  width: number | null;
  height: number | null;
  bitrate: number | null;
  averageBitrate: number | null;
  videoBitrate: number | null;
  audioBitrate: number | null;
  container: DownloadQualityOption['container'];
  mimeType: string | null;
  streamType: DownloadQualityOption['streamType'];
  codec: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  estimatedFileSize: number | null;
};

export type CreateDownloadFromQualityInput = {
  title: string;
  /** MUST be the selected variant URL — never the unresolved master unless identical. */
  sourceUrl: string;
  platform: string;
  thumbnailUrl: string;
  fileName: string;
  fileSize: string | number;
  /** Canonical quality label for durable persistence. */
  quality: string | null;
  /** Normalized WIDTHxHEIGHT when known. */
  resolution: string | null;
  /** Bits/sec when known — never 0-as-unknown. */
  bitrate: number | null;
  /** Rich local selection metadata (not all fields are posted). */
  selectedQuality: SelectedQualityMetadata;
};

export type ApiCreateDownloadPayload = {
  title: string;
  sourceUrl: string;
  platform: string;
  thumbnailUrl: string;
  fileName: string;
  fileSize: string | number;
  quality: string | null;
  resolution: string | null;
  bitrate: number | null;
};

function sanitizePlatform(platform: string): string {
  const trimmed = platform.trim().toUpperCase();
  if (/^[A-Z][A-Z0-9_]{0,49}$/.test(trimmed)) {
    return trimmed;
  }
  return 'OTHER';
}

function deriveFileName(option: QualityOption, selection: AnalyzedMediaSelection): string {
  const preferredExt =
    option.container === 'hls'
      ? 'ts'
      : option.container !== 'unknown'
        ? option.container
        : null;

  try {
    const path = new URL(option.sourceUrl).pathname.split('/').filter(Boolean).pop();
    if (path && path.includes('.')) {
      // Playlist URLs end in .m3u8 — never use that as the saved media filename.
      if (preferredExt && /\.(m3u8|m3u|mpd)$/i.test(path)) {
        const base = path.replace(/\.[^.]+$/, '') || 'vidorax_download';
        return `${base}.${preferredExt}`.slice(0, 180);
      }
      if (!preferredExt || path.toLowerCase().endsWith(`.${preferredExt}`)) {
        return path.slice(0, 180);
      }
    }
  } catch {
    // fall through
  }

  const ext = preferredExt ?? 'bin';
  const base =
    selection.title?.trim().replace(/[^\w.\- ]+/g, '').trim().slice(0, 80) ||
    'vidorax_download';
  return `${base}.${ext}`.slice(0, 180);
}

function placeholderThumbnail(selection: AnalyzedMediaSelection): string {
  try {
    const host = new URL(selection.finalUrl || selection.sourceUrl).hostname;
    if (host) {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
    }
  } catch {
    // fall through
  }
  return 'https://www.google.com/s2/favicons?domain=vidorax.app&sz=128';
}

function toSelectedQualityMetadata(option: DownloadQualityOption): SelectedQualityMetadata {
  return {
    id: option.id,
    label: option.label,
    sourceUrl: option.sourceUrl,
    resolution: option.resolution,
    width: option.width,
    height: option.height,
    bitrate: option.bitrate,
    averageBitrate: option.averageBitrate,
    videoBitrate: option.videoBitrate,
    audioBitrate: option.audioBitrate,
    container: option.container,
    mimeType: option.mimeType,
    streamType: option.streamType,
    codec: option.codec,
    videoCodec: option.videoCodec,
    audioCodec: option.audioCodec,
    estimatedFileSize: option.estimatedFileSize,
  };
}

/** Prefer explicit bitrate, then average — never invent. */
function resolveDurableBitrate(option: DownloadQualityOption): number | null {
  const candidates = [option.bitrate, option.averageBitrate, option.videoBitrate];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }
  }
  return null;
}

function resolveDurableQuality(option: DownloadQualityOption): string | null {
  const label = option.label?.trim();
  return label ? label.slice(0, 64) : null;
}

function resolveDurableResolution(option: DownloadQualityOption): string | null {
  if (option.resolution && /^[1-9]\d{1,4}x[1-9]\d{1,4}$/i.test(option.resolution.trim())) {
    return option.resolution.trim().toLowerCase();
  }
  if (
    typeof option.width === 'number' &&
    typeof option.height === 'number' &&
    option.width >= 10 &&
    option.height >= 10
  ) {
    return `${Math.trunc(option.width)}x${Math.trunc(option.height)}`;
  }
  return null;
}

/**
 * Build create payload from the selected downloadable option.
 * Returns null if the option is missing or not downloadable.
 */
export function toCreateDownloadInput(
  selection: AnalyzedMediaSelection,
  option: QualityOption | null,
): CreateDownloadFromQualityInput | null {
  if (!option || !option.downloadable || !option.sourceUrl) {
    return null;
  }

  const title =
    selection.title?.trim() ||
    (() => {
      try {
        const path = new URL(option.sourceUrl).pathname.split('/').filter(Boolean).pop();
        return path ? decodeURIComponent(path).slice(0, 255) : 'Download';
      } catch {
        return 'Download';
      }
    })();

  return {
    title: title.slice(0, 255),
    sourceUrl: option.sourceUrl,
    platform: sanitizePlatform(selection.platform || 'OTHER'),
    thumbnailUrl: selection.thumbnailUrl?.trim() || placeholderThumbnail(selection),
    fileName: deriveFileName(option, selection),
    fileSize: option.fileSize ?? option.estimatedFileSize ?? 0,
    quality: resolveDurableQuality(option),
    resolution: resolveDurableResolution(option),
    bitrate: resolveDurableBitrate(option),
    selectedQuality: toSelectedQualityMetadata(option),
  };
}

/** API-safe durable fields for POST /downloads. */
export function toApiCreateDownloadPayload(
  input: CreateDownloadFromQualityInput,
): ApiCreateDownloadPayload {
  return {
    title: input.title,
    sourceUrl: input.sourceUrl,
    platform: input.platform,
    thumbnailUrl: input.thumbnailUrl,
    fileName: input.fileName,
    fileSize: input.fileSize,
    quality: input.quality,
    resolution: input.resolution,
    bitrate: input.bitrate,
  };
}
