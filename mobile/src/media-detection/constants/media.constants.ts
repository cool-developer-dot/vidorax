import type {
  MediaContainer,
  ProgressiveAudioContainer,
  ProgressiveVideoContainer,
} from '../types';

/** Progressive video extensions (MVP). */
export const PROGRESSIVE_VIDEO_EXTENSIONS = [
  'mp4',
  'webm',
  'mov',
  'm4v',
] as const satisfies readonly ProgressiveVideoContainer[];

/** Progressive audio extensions (MVP). */
export const PROGRESSIVE_AUDIO_EXTENSIONS = [
  'mp3',
  'm4a',
  'aac',
  'ogg',
] as const satisfies readonly ProgressiveAudioContainer[];

/** Streaming extensions (MVP = HLS only). */
export const STREAM_EXTENSIONS = ['m3u8'] as const;

export const ALL_MEDIA_EXTENSIONS = [
  ...PROGRESSIVE_VIDEO_EXTENSIONS,
  ...PROGRESSIVE_AUDIO_EXTENSIONS,
  ...STREAM_EXTENSIONS,
] as const;

export const EXTENSION_TO_CONTAINER: Record<string, MediaContainer> = {
  mp4: 'mp4',
  webm: 'webm',
  mov: 'mov',
  m4v: 'm4v',
  mp3: 'mp3',
  m4a: 'm4a',
  aac: 'aac',
  ogg: 'ogg',
  m3u8: 'hls',
};

export const EXTENSION_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  m3u8: 'application/vnd.apple.mpegurl',
};

export const MIME_TO_EXTENSION: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'application/vnd.apple.mpegurl': 'm3u8',
  'application/x-mpegurl': 'm3u8',
  'audio/mpegurl': 'm3u8',
};

/** Schemes rejected for security — never treat as media. */
export const BLOCKED_MEDIA_SCHEMES = [
  'javascript:',
  'blob:',
  'file:',
  'data:',
  'about:',
  'vidorax:',
  'intent:',
  'market:',
  'content:',
] as const;

export const ALLOWED_MEDIA_SCHEMES = ['http:', 'https:'] as const;

/** Debounce / batching tunables for low-end Android. */
export const DETECTION_TIMING = {
  mutationBatchMs: 250,
  rescanDebounceMs: 400,
  manifestFetchTimeoutMs: 8_000,
  manifestMaxBytes: 512_000,
  maxCandidatesPerBatch: 40,
  maxDetectedPerPage: 80,
  performancePollMs: 1_500,
} as const;

export const CONFIDENCE = {
  baseUrlMatch: 0.55,
  mimeBoost: 0.15,
  domElementBoost: 0.2,
  dimensionsBoost: 0.05,
  durationBoost: 0.05,
  manifestBoost: 0.15,
  max: 0.99,
  minAccept: 0.4,
} as const;

/** Future protocol placeholders — architecture only. */
export const FUTURE_STREAM_PROTOCOLS = ['dash', 'cmaf'] as const;

export const MEDIA_DETECTION_VERSION = '1.0.0';
