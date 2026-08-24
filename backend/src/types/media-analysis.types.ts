/**
 * URL analysis contracts for POST /api/downloads/analyze.
 * Aligned with mobile downloads/quality canonical model.
 * Unknown values remain null — never fabricated.
 */

export const MEDIA_TYPES = ['video', 'audio', 'stream'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_CONTAINERS = [
  'mp4',
  'webm',
  'mov',
  'm4v',
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'hls',
  'unknown',
] as const;
export type MediaContainer = (typeof MEDIA_CONTAINERS)[number];

/**
 * Canonical stream classification for downloadable sources.
 * Future formats (e.g. DASH) may be added additively.
 */
export const DOWNLOAD_STREAM_TYPES = [
  'PROGRESSIVE',
  'HLS',
  'AUDIO',
  'UNKNOWN',
] as const;
export type DownloadStreamType = (typeof DOWNLOAD_STREAM_TYPES)[number];

/**
 * Explicit capability failure reasons.
 * Mirrors the engine/detection vocabulary without inventing parallel systems.
 */
export const ANALYSIS_UNSUPPORTED_REASONS = [
  'INVALID_URL',
  'NO_MEDIA',
  'UNSUPPORTED_FORMAT',
  'UNSUPPORTED_STREAM',
  'DRM_PROTECTED',
  'ENCRYPTED_MEDIA',
  'NETWORK_ERROR',
  'ANALYSIS_FAILED',
] as const;
export type AnalysisUnsupportedReason =
  (typeof ANALYSIS_UNSUPPORTED_REASONS)[number];

export interface AnalyzeUrlInput {
  url: string;
}

/**
 * One real downloadable (or explicitly unsupported) media variant.
 * Parser-internal details and secrets are never exposed.
 */
export interface MediaAnalysisVariant {
  id: string;
  sourceUrl: string;
  streamType: DownloadStreamType;
  label: string | null;
  resolution: string | null;
  width: number | null;
  height: number | null;
  /** Peak / declared BANDWIDTH when known. */
  bitrate: number | null;
  /** AVERAGE-BANDWIDTH when known. */
  averageBitrate: number | null;
  videoBitrate: number | null;
  audioBitrate: number | null;
  /** Raw CODECS string when present. */
  codecs: string | null;
  /** Conservatively normalized video codec label, else null. */
  videoCodec: string | null;
  /** Conservatively normalized audio codec label, else null. */
  audioCodec: string | null;
  container: MediaContainer;
  mimeType: string | null;
  /** Bytes when defensible; otherwise null. */
  estimatedFileSize: number | null;
  frameRate: number | null;
  downloadable: boolean;
  unsupportedReason: AnalysisUnsupportedReason | null;
}

/**
 * Normalized analysis payload.
 * Top-level media fields remain a backward-compatible summary of the primary variant.
 * `variants` is the canonical multi-quality source of truth.
 */
export interface MediaAnalysisResult {
  title: string | null;
  sourceUrl: string;
  finalUrl: string;
  thumbnailUrl: string | null;
  mediaType: MediaType | null;
  mimeType: string | null;
  container: MediaContainer;
  duration: number | null;
  width: number | null;
  height: number | null;
  resolution: string | null;
  bitrate: number | null;
  fps: number | null;
  /** Decimal string when Content-Length is known; otherwise null. */
  fileSize: string | null;
  /** Hostname-derived slug compatible with Download API platform pattern. */
  platform: string;
  downloadable: boolean;
  unsupportedReason: AnalysisUnsupportedReason | null;
  /** Real downloadable quality variants — never fabricated ladders. */
  variants: MediaAnalysisVariant[];
}

export interface AnalyzeDownloadResponse {
  analysis: MediaAnalysisResult;
}
