import {
  EXTENSION_TO_CONTAINER,
  EXTENSION_TO_MIME,
  MIME_TO_EXTENSION,
  PROGRESSIVE_AUDIO_EXTENSIONS,
  PROGRESSIVE_VIDEO_EXTENSIONS,
  STREAM_EXTENSIONS,
} from '../constants';
import type { MediaCategory, MediaContainer } from '../types';

const VIDEO_SET = new Set<string>(PROGRESSIVE_VIDEO_EXTENSIONS);
const AUDIO_SET = new Set<string>(PROGRESSIVE_AUDIO_EXTENSIONS);
const STREAM_SET = new Set<string>(STREAM_EXTENSIONS);

/**
 * Extract a file extension from a URL path (ignores query/hash).
 */
export function parseExtensionFromUrl(url: string): string | null {
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
}

export function parseExtensionFromMime(mime: string | null | undefined): string | null {
  if (!mime) {
    return null;
  }
  const base = mime.split(';')[0]?.trim().toLowerCase();
  if (!base) {
    return null;
  }
  return MIME_TO_EXTENSION[base] ?? null;
}

export function resolveExtension(
  url: string,
  mimeType?: string | null,
): string | null {
  return parseExtensionFromUrl(url) ?? parseExtensionFromMime(mimeType);
}

export function resolveContainer(extension: string | null): MediaContainer {
  if (!extension) {
    return 'unknown';
  }
  return EXTENSION_TO_CONTAINER[extension] ?? 'unknown';
}

export function resolveMimeType(
  extension: string | null,
  mimeType?: string | null,
): string | null {
  if (mimeType) {
    return mimeType.split(';')[0]?.trim().toLowerCase() || null;
  }
  if (!extension) {
    return null;
  }
  return EXTENSION_TO_MIME[extension] ?? null;
}

export function resolveCategory(
  container: MediaContainer,
  extension: string | null,
): MediaCategory | null {
  if (container === 'hls' || (extension && STREAM_SET.has(extension))) {
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
}

export function isSupportedMediaUrl(
  url: string,
  mimeType?: string | null,
): boolean {
  const extension = resolveExtension(url, mimeType);
  if (!extension) {
    // MIME-only fallback for streaming content-types without extension.
    if (mimeType) {
      const fromMime = parseExtensionFromMime(mimeType);
      return fromMime != null && resolveCategory(resolveContainer(fromMime), fromMime) != null;
    }
    return false;
  }
  return resolveCategory(resolveContainer(extension), extension) != null;
}
