/**
 * Core media detection domain types.
 * Detection-only — no download queue / quality UI contracts live here.
 */

export type MediaCategory = 'video' | 'audio' | 'stream';

export type ProgressiveVideoContainer = 'mp4' | 'webm' | 'mov' | 'm4v';
export type ProgressiveAudioContainer = 'mp3' | 'm4a' | 'aac' | 'ogg';
export type StreamContainer = 'hls';

/** MVP containers. CMAF / DASH reserved for later phases. */
export type MediaContainer =
  | ProgressiveVideoContainer
  | ProgressiveAudioContainer
  | StreamContainer
  | 'unknown';

/** Future-ready stream protocol identifiers (only HLS is implemented). */
export type StreamProtocol = 'hls' | 'dash' | 'cmaf' | 'unknown';

export type HlsPlaylistType = 'master' | 'variant' | 'media' | 'unknown';

export type DetectionSource =
  | 'dom_video'
  | 'dom_audio'
  | 'dom_source'
  | 'network_request'
  | 'performance_resource'
  | 'og_meta'
  | 'manifest'
  | 'navigation';

export type MediaDetectionErrorCode =
  | 'unsupported_page'
  | 'private_content'
  | 'drm_protected'
  | 'encrypted_hls'
  | 'broken_manifest'
  | 'missing_metadata'
  | 'invalid_media'
  | 'malformed_url'
  | 'timeout'
  | 'cross_origin'
  | 'detection_failure'
  | 'unknown';

export interface MediaDimensions {
  width: number | null;
  height: number | null;
  resolution: string | null;
  aspectRatio: number | null;
}

/**
 * Fully normalized detected media candidate.
 * Unavailable fields are explicitly null — never fabricated.
 */
export interface DetectedMedia {
  id: string;
  url: string;
  pageUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  resolution: string | null;
  aspectRatio: number | null;
  estimatedFileSize: number | null;
  codec: string | null;
  bitrate: number | null;
  mimeType: string | null;
  extension: string | null;
  container: MediaContainer;
  category: MediaCategory;
  isLive: boolean;
  isDrm: boolean;
  playlistType: HlsPlaylistType | null;
  streamProtocol: StreamProtocol | null;
  websiteSource: string | null;
  detectionSource: DetectionSource;
  detectedAt: number;
  confidence: number;
  /** Soft tags for future Download Manager mapping (platform slug). */
  platformHint: string | null;
}

export interface MediaQualityVariant {
  id: string;
  mediaId: string;
  bandwidth: number | null;
  width: number | null;
  height: number | null;
  resolution: string | null;
  codecs: string | null;
  url: string;
  playlistType: HlsPlaylistType;
}

export interface PageMediaMetadata {
  pageUrl: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  ogVideo: string | null;
  canonicalUrl: string | null;
  websiteSource: string | null;
  updatedAt: number;
}

export interface DetectionStatistics {
  totalDetected: number;
  videoCount: number;
  audioCount: number;
  streamCount: number;
  duplicateUpdates: number;
  rejectedCount: number;
  lastScanDurationMs: number;
  scansCompleted: number;
}

export interface MediaDetectionError {
  code: MediaDetectionErrorCode;
  message: string;
  url: string | null;
  occurredAt: number;
}

/** Lightweight candidate emitted by observers before enrichment. */
export interface MediaCandidate {
  url: string;
  pageUrl: string;
  mimeType?: string | null;
  extension?: string | null;
  title?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  estimatedFileSize?: number | null;
  isLive?: boolean;
  isDrm?: boolean;
  playlistType?: HlsPlaylistType | null;
  streamProtocol?: StreamProtocol | null;
  detectionSource: DetectionSource;
  confidenceHint?: number;
}
