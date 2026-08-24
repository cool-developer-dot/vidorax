import type { DownloadItem, DownloadStatus } from '@/store/downloads';
import {
  canUseCompletedLocalMedia,
  downloadEngine,
  isPlaylistOrStreamUrl,
} from '@/downloads/engine';
import type { TransferProgressSnapshot } from '@/downloads/engine/types';
import {
  deriveDownloadExecutionDisplayState,
  downloadAppLifecycle,
  type DownloadExecutionDisplayState,
} from '@/downloads/execution';
import type { QueueWaitingReason } from '@/downloads/scheduler';

import { translate } from '@/localization/translate';
import type { TranslationKey } from '@/localization/types';

import { DOWNLOAD_SECTION_ORDER } from '../constants/downloads.constants';

const DOWNLOAD_STATUS_KEYS: Record<DownloadStatus, TranslationKey> = {
  QUEUED: 'downloads.statusQueued',
  DOWNLOADING: 'downloads.statusDownloading',
  PAUSED: 'downloads.statusPaused',
  COMPLETED: 'downloads.statusCompleted',
  FAILED: 'downloads.statusFailed',
  CANCELLED: 'downloads.statusCancelled',
};

const DOWNLOAD_EXECUTION_KEYS: Record<DownloadExecutionDisplayState, TranslationKey> = {
  DOWNLOADING_FOREGROUND: 'downloads.executionForeground',
  DOWNLOADING_BACKGROUND: 'downloads.executionBackground',
  WAITING_FOR_WIFI: 'downloads.waitingWifi',
  WAITING_FOR_CONNECTION: 'downloads.waitingNetwork',
  WAITING_FOR_RETRY: 'downloads.retrying',
  WAITING_CAPACITY: 'downloads.queued',
  PREPARING: 'downloads.preparing',
  PAUSED: 'downloads.statusPaused',
  FINALIZING: 'downloads.finalizing',
  COMPLETED: 'downloads.statusCompleted',
  FAILED: 'downloads.statusFailed',
  CANCELLED: 'downloads.statusCancelled',
  QUEUED: 'downloads.queued',
};

export type DownloadListSection = {
  key: DownloadStatus;
  title: string;
  data: string[];
};

export function formatDownloadFileSize(fileSize: string): string | null {
  try {
    const bytes = Number(fileSize);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return null;
    }

    if (bytes < 1024) {
      return `${Math.round(bytes)} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } catch {
    return null;
  }
}

/** Display durable resolution; omit unknowns. */
export function formatDurableResolution(
  resolution: string | null | undefined,
): string | null {
  if (!resolution || typeof resolution !== 'string') {
    return null;
  }
  const match = /^([1-9]\d{1,4})x([1-9]\d{1,4})$/i.exec(resolution.trim());
  if (!match) {
    return null;
  }
  return `${match[1]} × ${match[2]}`;
}

/** Display durable bitrate; omit unknowns / non-positive. */
export function formatDurableBitrate(
  bitrate: number | null | undefined,
): string | null {
  if (typeof bitrate !== 'number' || !Number.isFinite(bitrate) || bitrate <= 0) {
    return null;
  }
  if (bitrate >= 1_000_000) {
    const mbps = bitrate / 1_000_000;
    const text = mbps >= 10 ? mbps.toFixed(0) : mbps.toFixed(1);
    return `${text} Mbps`;
  }
  if (bitrate >= 1_000) {
    return `${Math.round(bitrate / 1_000)} Kbps`;
  }
  return `${Math.round(bitrate)} bps`;
}

export function formatTransferSpeed(bytesPerSecond: number | null): string | null {
  if (bytesPerSecond == null || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return null;
  }
  return `${formatDownloadFileSize(String(Math.round(bytesPerSecond)))}/s`;
}

export function formatEtaSeconds(etaSeconds: number | null): string | null {
  if (etaSeconds == null || !Number.isFinite(etaSeconds) || etaSeconds <= 0) {
    return null;
  }
  if (etaSeconds < 60) {
    return `${Math.ceil(etaSeconds)}s left`;
  }
  const minutes = Math.floor(etaSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m left`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m left` : `${hours}h left`;
}

export function formatDownloadedBytes(
  fileSize: string,
  progress: number,
): string | null {
  try {
    const total = Number(fileSize);
    if (!Number.isFinite(total) || total < 0) {
      return null;
    }
    if (!Number.isFinite(progress) || progress <= 0) {
      return formatDownloadFileSize('0');
    }

    const downloaded = Math.round((Math.min(100, progress) / 100) * total);
    return formatDownloadFileSize(String(downloaded));
  } catch {
    return null;
  }
}

export function extractMediaType(fileName: string): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return null;
  }

  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) {
    return null;
  }

  const ext = trimmed.slice(dot + 1).toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(ext)) {
    return null;
  }

  return ext;
}

export function formatPlatform(platform: string): string | null {
  const value = platform.trim();
  if (!value) {
    return null;
  }
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getStatusLabel(status: DownloadStatus): string {
  const key = DOWNLOAD_STATUS_KEYS[status];
  return key ? translate(key) : status;
}

/**
 * Customer-facing execution label — never exposes raw WorkerState enums.
 * "Downloading in background" only when Android FGS is protecting this job.
 */
export function getExecutionStatusLabel(options: {
  status: DownloadStatus;
  workerState?: string | null;
  waitingReason?: QueueWaitingReason | null;
  downloadId?: string;
  retryDelay?: boolean;
}): string {
  const downloadId = options.downloadId;
  let hasActiveExecution = false;
  let backgroundServiceActive = false;
  let retryDelay = options.retryDelay === true;
  let waitingReason = options.waitingReason ?? null;

  if (downloadId) {
    try {
      const evidence = downloadEngine.getJobEvidence(downloadId);
      hasActiveExecution = evidence.hasActiveWorker;
      retryDelay = retryDelay || evidence.isRetryScheduled;

      const ledger = downloadEngine.getBackgroundExecutionLedger();
      backgroundServiceActive =
        downloadEngine.isForegroundServiceActive() &&
        ledger.protectedDownloadIds.includes(downloadId);

      if (!waitingReason) {
        const snap = downloadEngine.getQueueSnapshot();
        const pending = snap.pending.find((p) => p.downloadId === downloadId);
        waitingReason = pending?.waitingReason ?? null;
      }
    } catch {
      // engine unavailable in tests / early boot
    }
  }

  const state: DownloadExecutionDisplayState = deriveDownloadExecutionDisplayState({
    status: options.status,
    workerState: options.workerState,
    waitingReason,
    appState: downloadAppLifecycle.getPhase(),
    backgroundServiceActive,
    hasActiveExecution,
    retryDelay,
  });

  return translate(DOWNLOAD_EXECUTION_KEYS[state]);
}

export function buildMetaLine(item: DownloadItem): string {
  const parts: string[] = [];
  const mediaType = extractMediaType(item.fileName);
  const size = formatDownloadFileSize(item.fileSize);
  const platform = formatPlatform(item.platform);

  if (mediaType) {
    parts.push(mediaType);
  }
  if (size) {
    parts.push(size);
  }
  if (platform) {
    parts.push(platform);
  }

  return parts.join(' · ');
}

export function buildProgressMeta(
  item: DownloadItem,
  transfer?: TransferProgressSnapshot | null,
): string | null {
  if (item.status === 'COMPLETED') {
    if (transfer?.localState === 'missing') {
      return 'File missing on device';
    }
    const size =
      transfer?.totalBytes != null && transfer.totalBytes > 0
        ? formatDownloadFileSize(String(transfer.totalBytes))
        : formatDownloadFileSize(item.fileSize);
    return size ? `${size} saved` : null;
  }

  if (
    item.status !== 'DOWNLOADING' &&
    item.status !== 'PAUSED' &&
    item.status !== 'QUEUED'
  ) {
    return item.errorMessage?.trim() || null;
  }

  const speed = formatTransferSpeed(transfer?.bytesPerSecond ?? null);
  const eta = formatEtaSeconds(transfer?.etaSeconds ?? null);

  const downloaded =
    transfer?.bytesWritten != null && transfer.bytesWritten > 0
      ? formatDownloadFileSize(String(transfer.bytesWritten))
      : formatDownloadedBytes(item.fileSize, item.progress);

  const knownTotalBytes =
    transfer?.totalBytes != null && transfer.totalBytes > 0
      ? transfer.totalBytes
      : Number(item.fileSize) > 0
        ? Number(item.fileSize)
        : null;
  const total =
    knownTotalBytes != null
      ? formatDownloadFileSize(String(knownTotalBytes))
      : null;

  // Unknown Content-Length: show bytes + speed only — never "X of 0 B".
  const sizePart =
    downloaded && total
      ? `${downloaded} of ${total}`
      : downloaded
        ? `${downloaded} downloaded`
        : null;

  return [sizePart, speed, eta].filter(Boolean).join(' · ') || null;
}

export function groupDownloadsIntoSections(
  orderedIds: string[],
  itemsById: Record<string, DownloadItem>,
): DownloadListSection[] {
  const buckets: Record<DownloadStatus, string[]> = {
    DOWNLOADING: [],
    QUEUED: [],
    PAUSED: [],
    COMPLETED: [],
    FAILED: [],
    CANCELLED: [],
  };

  for (const id of orderedIds) {
    const item = itemsById[id];
    if (!item) {
      continue;
    }
    buckets[item.status]?.push(id);
  }

  return DOWNLOAD_SECTION_ORDER.filter((section) => buckets[section.key].length > 0).map(
    (section) => ({
      key: section.key,
      title: getStatusLabel(section.key),
      data: buckets[section.key],
    }),
  );
}

export type DownloadCardAction =
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'retry'
  | 'open'
  | 'share'
  | 'remove';

function canResumeProgressive(sourceUrl?: string | null): boolean {
  if (!sourceUrl?.trim()) {
    // Unknown source — keep Resume available; engine will validate pauseState.
    return true;
  }
  return !isPlaylistOrStreamUrl(sourceUrl);
}

export type LocalMediaActionOptions = {
  localUri?: string | null;
  localState?: TransferProgressSnapshot['localState'] | null;
};

/** Canonical Open/Share gate — Card and Details must share this. */
export function canOpenOrShareCompletedFile(
  status: DownloadStatus,
  options?: LocalMediaActionOptions,
): boolean {
  return canUseCompletedLocalMedia({
    status,
    localUri: options?.localUri,
    localState: options?.localState,
  });
}

export function getSupportedActions(
  status: DownloadStatus,
  sourceUrl?: string | null,
  localMedia?: LocalMediaActionOptions,
): DownloadCardAction[] {
  switch (status) {
    case 'DOWNLOADING':
      return canResumeProgressive(sourceUrl) ? ['pause', 'cancel'] : ['cancel'];
    case 'PAUSED':
      return canResumeProgressive(sourceUrl)
        ? ['resume', 'cancel']
        : ['cancel'];
    case 'QUEUED':
      return ['cancel'];
    case 'FAILED':
      return ['retry', 'remove'];
    case 'COMPLETED': {
      if (canOpenOrShareCompletedFile(status, localMedia)) {
        return ['open', 'share', 'remove'];
      }
      return ['remove'];
    }
    case 'CANCELLED':
      return ['remove'];
    default:
      return [];
  }
}

/** Recommended primary control for the Details screen. */
export function getPrimaryAction(
  status: DownloadStatus,
  sourceUrl?: string | null,
  localMedia?: LocalMediaActionOptions,
): DownloadCardAction | null {
  switch (status) {
    case 'DOWNLOADING':
      return canResumeProgressive(sourceUrl) ? 'pause' : 'cancel';
    case 'PAUSED':
      return canResumeProgressive(sourceUrl) ? 'resume' : 'cancel';
    case 'QUEUED':
      return 'cancel';
    case 'FAILED':
      return 'retry';
    case 'COMPLETED':
      return canOpenOrShareCompletedFile(status, localMedia) ? 'open' : 'remove';
    case 'CANCELLED':
      return 'remove';
    default:
      return null;
  }
}

export function formatDownloadDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatSourceHost(sourceUrl: string): string | null {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

export function sanitizeErrorMessage(message: string | null | undefined): string {
  const trimmed = message?.trim();
  if (!trimmed) {
    return translate('errors.downloadFailed');
  }

  // Avoid leaking raw internals.
  if (
    /stack|exception|prisma|sql|ECONN|ETIMEDOUT|undefined|null is not/i.test(
      trimmed,
    )
  ) {
    return translate('errors.downloadFailed');
  }

  return trimmed;
}
