import type { DownloadHistory } from '@prisma/client';

import { assertSafeFileName } from '../downloads/sanitize.js';
import type { MediaLibraryItem } from '../../types/media-library.types.js';

const MIME_FROM_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) {
    return '';
  }
  return fileName.slice(dot + 1).toLowerCase();
}

export function mimeFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) {
    return null;
  }
  const ext = extensionOf(fileName);
  return MIME_FROM_EXT[ext] ?? null;
}

export function isSafeRemoteThumbnailUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export function toMediaLibraryItem(
  download: DownloadHistory,
  favorite: boolean,
  folderName: string | null,
): MediaLibraryItem | null {
  let fileName: string;
  try {
    fileName = assertSafeFileName(download.fileName);
  } catch {
    return null;
  }

  const displayName = download.title.trim() || fileName;
  if (!displayName) {
    return null;
  }

  return {
    id: download.id,
    downloadId: download.id,
    displayName,
    fileName,
    mimeType: mimeFromFileName(fileName),
    fileSize: download.fileSize.toString(),
    quality: download.quality,
    resolution: download.resolution,
    bitrate: download.bitrate,
    duration: null,
    downloadedAt: download.downloadedAt,
    favorite,
    folderId: download.folderId ?? null,
    folderName: download.folderId == null ? 'Downloads / Unfiled' : folderName,
    thumbnailUrl: isSafeRemoteThumbnailUrl(download.thumbnailUrl),
  };
}
