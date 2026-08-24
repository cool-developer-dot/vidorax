/**
 * MIME / extension / container mapping aligned with mobile media-detection.
 */

import type {
  MediaContainer,
  MediaType,
} from '../../types/media-analysis.types.js';

export const PROGRESSIVE_VIDEO_EXTENSIONS = [
  'mp4',
  'webm',
  'mov',
  'm4v',
] as const;

export const PROGRESSIVE_AUDIO_EXTENSIONS = [
  'mp3',
  'm4a',
  'aac',
  'ogg',
] as const;

export const STREAM_EXTENSIONS = ['m3u8'] as const;

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

const VIDEO_SET = new Set<string>(PROGRESSIVE_VIDEO_EXTENSIONS);
const AUDIO_SET = new Set<string>(PROGRESSIVE_AUDIO_EXTENSIONS);
const STREAM_SET = new Set<string>(STREAM_EXTENSIONS);

export const normalizeMimeType = (
  mimeType: string | null | undefined,
): string | null => {
  if (!mimeType) {
    return null;
  }
  return mimeType.split(';')[0]?.trim().toLowerCase() || null;
};

export const parseExtensionFromUrl = (url: string): string | null => {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const last = pathname.split('/').pop() ?? '';
    const dot = last.lastIndexOf('.');
    if (dot <= 0 || dot === last.length - 1) {
      return null;
    }
    const ext = last.slice(dot + 1).replace(/[^a-z0-9]/g, '');
    return ext || null;
  } catch {
    return null;
  }
};

export const parseExtensionFromMime = (
  mime: string | null | undefined,
): string | null => {
  const base = normalizeMimeType(mime);
  if (!base) {
    return null;
  }
  return MIME_TO_EXTENSION[base] ?? null;
};

export const resolveExtension = (
  url: string,
  mimeType?: string | null,
): string | null => {
  return parseExtensionFromUrl(url) ?? parseExtensionFromMime(mimeType);
};

export const resolveContainer = (extension: string | null): MediaContainer => {
  if (!extension) {
    return 'unknown';
  }
  return EXTENSION_TO_CONTAINER[extension] ?? 'unknown';
};

export const resolveMimeType = (
  extension: string | null,
  mimeType?: string | null,
): string | null => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized) {
    return normalized;
  }
  if (!extension) {
    return null;
  }
  return EXTENSION_TO_MIME[extension] ?? null;
};

export const resolveMediaType = (
  container: MediaContainer,
  extension: string | null,
): MediaType | null => {
  if (container === 'hls' || (extension != null && STREAM_SET.has(extension))) {
    return 'stream';
  }
  if (
    VIDEO_SET.has(container) ||
    (extension != null && VIDEO_SET.has(extension))
  ) {
    return 'video';
  }
  if (
    AUDIO_SET.has(container) ||
    (extension != null && AUDIO_SET.has(extension))
  ) {
    return 'audio';
  }
  return null;
};

export const isPlaylistOrStreamUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.toLowerCase();
    const ext = path.includes('.') ? (path.split('.').pop() ?? '') : '';
    if (ext === 'm3u8' || ext === 'mpd' || ext === 'm3u') {
      return true;
    }
    return path.includes('.m3u8') || path.includes('.mpd');
  } catch {
    return false;
  }
};

export const isHlsMimeType = (mimeType: string | null | undefined): boolean => {
  const base = normalizeMimeType(mimeType);
  if (!base) {
    return false;
  }
  return (
    base === 'application/vnd.apple.mpegurl' ||
    base === 'application/x-mpegurl' ||
    base === 'audio/mpegurl'
  );
};

/** HTML / document responses — not media resources. */
export const isNonMediaDocumentMime = (
  mimeType: string | null | undefined,
): boolean => {
  const base = normalizeMimeType(mimeType);
  if (!base) {
    return false;
  }
  return (
    base.startsWith('text/') ||
    base === 'application/json' ||
    base === 'application/xml' ||
    base === 'application/xhtml+xml' ||
    base === 'application/javascript' ||
    base === 'image/svg+xml'
  );
};

/**
 * Hostname slug compatible with Download API platform pattern.
 * Never invents marketing names.
 */
export const derivePlatform = (url: string): string => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host) {
      return 'OTHER';
    }

    const bare = host.replace(/^www\./, '');
    const slug = bare
      .split('.')
      .slice(0, -1)
      .join('_')
      .replace(/[^a-z0-9_]/gi, '')
      .toUpperCase();

    if (slug && /^[A-Z][A-Z0-9_]{0,49}$/.test(slug)) {
      return slug;
    }

    const fallback = bare
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toUpperCase()
      .slice(0, 50);

    if (fallback && /^[A-Z][A-Z0-9_]{0,49}$/.test(fallback)) {
      return fallback;
    }

    return 'OTHER';
  } catch {
    return 'OTHER';
  }
};

export const extractFilenameFromContentDisposition = (
  header: string | null,
): string | null => {
  if (!header) {
    return null;
  }

  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, '')) || null;
    } catch {
      // fall through
    }
  }

  const plain = /filename\s*=\s*("?)([^";]+)\1/i.exec(header);
  if (plain?.[2]) {
    return plain[2].trim() || null;
  }

  return null;
};
