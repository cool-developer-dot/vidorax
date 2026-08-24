/**
 * One-time wiring: engine events → optional notifications + FGS summary.
 * Attaches once for app lifetime. Never starts workers.
 */

import { downloadEngine } from '@/downloads/engine';
import { useDownloadsStore } from '@/store/downloads';
import { useAuthStore } from '@/store/auth';
import { selectIsAuthenticated } from '@/store/auth/selectors';
import {
  sanitizeNotificationTitle,
} from './aggregate-progress';
import {
  setNotificationAuthProbe,
  setNotificationExistsProbe,
} from './deep-link';
import { createFgsSummaryPublisher, type FgsSummaryPublisher } from './fgs-summary';
import { getDownloadNotificationService } from './service';
import { getBackgroundExecutionController } from '../execution/platform-controller';
import { getDownloadExecutionCoordinator } from '../execution/coordinator';
import type { FgsNotificationSummary } from './types';

let attached = false;
let publisher: FgsSummaryPublisher | null = null;
let unsubEngine: (() => void) | null = null;
let unsubProgress: (() => void) | null = null;
let unsubQueue: (() => void) | null = null;

export function ensureDownloadNotificationBridge(): void {
  if (attached) {
    return;
  }
  attached = true;

  const notifications = getDownloadNotificationService();
  void notifications.initialize();

  setNotificationAuthProbe(() => selectIsAuthenticated(useAuthStore.getState()));
  setNotificationExistsProbe((downloadId) => {
    const local = useDownloadsStore.getState().itemsById[downloadId];
    return Boolean(local);
  });

  const controller = getBackgroundExecutionController();

  publisher = createFgsSummaryPublisher({
    updateSummary: async (summary: FgsNotificationSummary) => {
      const extended = controller as {
        updateNotificationSummary?: (
          s: FgsNotificationSummary,
        ) => Promise<void>;
      };
      if (typeof extended.updateNotificationSummary === 'function') {
        await extended.updateNotificationSummary(summary);
      }
    },
    getActiveJobs: () => {
      const ledger = getDownloadExecutionCoordinator().getLedgerSnapshot();
      const store = useDownloadsStore.getState();
      return ledger.protectedDownloadIds.map((id) => {
        const item = store.itemsById[id];
        const transfer = store.transferById[id];
        return {
          downloadId: id,
          title: item?.title ?? null,
          fileName: item?.fileName ?? null,
          bytesDownloaded: transfer?.bytesWritten ?? 0,
          totalBytes:
            transfer?.totalBytes != null && transfer.totalBytes > 0
              ? transfer.totalBytes
              : null,
          progressPercent: transfer?.progress ?? null,
        };
      });
    },
    getWaitingCount: () => {
      try {
        return downloadEngine.getQueueSnapshot().pending.length;
      } catch {
        return 0;
      }
    },
  });

  unsubEngine = downloadEngine.subscribe((event) => {
    if (event.type === 'completed') {
      const item = useDownloadsStore.getState().itemsById[event.downloadId];
      const title = sanitizeNotificationTitle(item?.title, item?.fileName);
      void notifications.notifyCompleted({
        downloadId: event.downloadId,
        title,
      });
      publisher?.onStructureChange();
      return;
    }
    if (event.type === 'failed') {
      const downloadId = event.downloadId;
      const item = useDownloadsStore.getState().itemsById[downloadId];
      const title = sanitizeNotificationTitle(item?.title, item?.fileName);
      // Defer so afterWorkerSettled can register auto-retry before we decide.
      setTimeout(() => {
        const evidence = downloadEngine.getJobEvidence(downloadId);
        if (evidence.isRetryScheduled || evidence.isQueued) {
          return;
        }
        const current = useDownloadsStore.getState().itemsById[downloadId];
        if (
          current?.status === 'CANCELLED' ||
          current?.status === 'COMPLETED' ||
          current?.status === 'QUEUED' ||
          current?.status === 'DOWNLOADING'
        ) {
          return;
        }
        void notifications.notifyFailed({ downloadId, title });
      }, 80);
      publisher?.onStructureChange();
      return;
    }
    if (
      event.type === 'cancelled' ||
      event.type === 'status'
    ) {
      publisher?.onStructureChange();
    }
  });

  unsubProgress = downloadEngine.subscribeProgress(() => {
    publisher?.onProgress();
  });

  unsubQueue = downloadEngine.subscribeQueue(() => {
    publisher?.onStructureChange();
  });
}

/** Test helper. */
export function resetDownloadNotificationBridgeForTests(): void {
  unsubEngine?.();
  unsubProgress?.();
  unsubQueue?.();
  unsubEngine = null;
  unsubProgress = null;
  unsubQueue = null;
  publisher?.cancel();
  publisher = null;
  attached = false;
}
