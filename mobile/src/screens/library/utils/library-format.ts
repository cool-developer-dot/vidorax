import type { MediaLibraryItem } from '@/library';
import {
  formatDownloadDate,
  formatDownloadFileSize,
  formatDurableResolution,
} from '@/screens/downloads/utils/download-format';

export function formatLibraryFileSize(fileSize: string): string | null {
  return formatDownloadFileSize(fileSize);
}

export function formatLibraryDate(isoDate: string | null): string | null {
  return formatDownloadDate(isoDate);
}

export function formatLibraryResolution(
  resolution: string | null,
): string | null {
  return formatDurableResolution(resolution);
}

export function buildLibraryMetaLine(item: MediaLibraryItem): string {
  const parts: string[] = [];
  const size = formatLibraryFileSize(item.fileSize);
  if (size) {
    parts.push(size);
  }
  if (item.quality) {
    parts.push(item.quality);
  }
  const resolution = formatLibraryResolution(item.resolution);
  if (resolution && resolution.replace(/\s+/g, '') !== item.quality) {
    parts.push(resolution);
  }
  const date = formatLibraryDate(item.downloadedAt);
  if (date) {
    parts.push(date);
  }
  return parts.join(' · ');
}

export function buildLibraryGridMeta(item: MediaLibraryItem): string {
  const parts: string[] = [];
  if (item.quality) {
    parts.push(item.quality);
  }
  const size = formatLibraryFileSize(item.fileSize);
  if (size) {
    parts.push(size);
  }
  return parts.join(' · ');
}
