import { observeRequestUrl, parseMediaBridgeMessage } from '../adapters';
import { DETECTION_TIMING } from '../constants';
import {
  mediaDetectionPipeline,
  notifyBrowserDetectionSync,
  type PipelineResult,
} from '../services';
import { useMediaDetectionStore } from '../stores';
import type {
  BridgeMediaCandidatePayload,
  BridgeMutationBatchPayload,
  BridgePageMetaPayload,
} from '../types';
import { createDebounced, isSameDocumentUrl } from '../utils';

/**
 * Media Detection Engine — passive observer of browser activity.
 * Never interrupts navigation. Never downloads. Never shows UI.
 */
class MediaDetectionEngine {
  private started = false;
  private pageUrl: string | null = null;
  private navigationEpoch = 0;
  /** When false, high-frequency bridge work is deferred (app backgrounded). */
  private appActive = true;
  private readonly debouncedRescanNotify = createDebounced(() => {
    notifyBrowserDetectionSync();
  }, DETECTION_TIMING.rescanDebounceMs);

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    mediaDetectionPipeline.reset();
  }

  stop(): void {
    this.started = false;
    this.pageUrl = null;
    this.appActive = true;
    this.debouncedRescanNotify.cancel();
    mediaDetectionPipeline.reset();
  }

  /**
   * Background/foreground — preserve detections; skip mutation thrash while inactive.
   */
  setAppActive(active: boolean): void {
    this.appActive = active;
    if (active) {
      this.debouncedRescanNotify();
    } else {
      this.debouncedRescanNotify.cancel();
    }
  }

  /**
   * Called when browser navigation commits a new document URL.
   */
  onNavigationStart(url: string, epoch?: number): void {
    if (!this.started) {
      this.start();
    }

    this.navigationEpoch =
      typeof epoch === 'number' && Number.isFinite(epoch)
        ? epoch
        : this.navigationEpoch + 1;

    const store = useMediaDetectionStore.getState();
    this.pageUrl = url;
    store.clearPageDetections();
    store.setLastNavigation(url, this.navigationEpoch);
    store.setScanning(true, 0.1);
    store.setDetectionError(null);
    mediaDetectionPipeline.reset();
  }

  onNavigationComplete(url: string): void {
    if (!this.pageUrl) {
      return;
    }
    const store = useMediaDetectionStore.getState();
    this.pageUrl = url;
    store.setLastNavigation(url, this.navigationEpoch);
    store.setScanning(true, 0.5);
  }

  onGoHome(): void {
    const store = useMediaDetectionStore.getState();
    this.pageUrl = null;
    this.navigationEpoch += 1;
    store.clearPageDetections();
    store.setLastNavigation(null, this.navigationEpoch);
    store.setScanning(false, 0);
    mediaDetectionPipeline.reset();
  }

  /**
   * Passive network URL observation (does not affect allow/deny).
   */
  observeUrl(url: string, pageUrl?: string): void {
    if (!this.started || !this.pageUrl) {
      return;
    }

    const effectivePage = pageUrl ?? this.pageUrl;
    if (!isSameDocumentUrl(effectivePage, this.pageUrl)) {
      return;
    }

    const observed = observeRequestUrl(url, effectivePage);
    if (!observed) {
      return;
    }

    const epoch = this.navigationEpoch;
    const store = useMediaDetectionStore.getState();
    const result = mediaDetectionPipeline.processNetworkUrl(
      store.detectedMedia,
      observed.url,
      observed.pageUrl,
      store.qualities,
    );
    if (!this.isCurrentEpoch(epoch)) {
      return;
    }
    this.applyPipelineResult(result);
    void this.maybeEnrichHls(result, epoch);
  }

  handleWebViewMessage(raw: string): void {
    if (!this.started || !this.pageUrl) {
      return;
    }

    const message = parseMediaBridgeMessage(raw);
    if (!message) {
      return;
    }

    switch (message.type) {
      case 'ready':
        useMediaDetectionStore.getState().setScanning(true, 0.3);
        break;
      case 'page_meta':
        this.handlePageMeta(message.payload);
        break;
      case 'media_candidate':
        this.handleCandidate(message.payload);
        break;
      case 'mutation_batch':
        // High-frequency DOM churn — skip while backgrounded; page will rescan on resume.
        if (!this.appActive) {
          break;
        }
        this.handleBatch(message.payload);
        break;
      case 'scan_complete':
        useMediaDetectionStore.getState().setScanning(false, 1);
        this.debouncedRescanNotify();
        break;
      case 'error':
        useMediaDetectionStore.getState().setDetectionError({
          code: 'detection_failure',
          message: message.payload.message || 'Detection error',
          url: this.pageUrl,
          occurredAt: Date.now(),
        });
        break;
      default:
        break;
    }
  }

  private handlePageMeta(payload: BridgePageMetaPayload): void {
    if (!this.acceptsPageUrl(payload.pageUrl)) {
      return;
    }

    const meta = mediaDetectionPipeline.processPageMeta(payload);
    if (meta) {
      useMediaDetectionStore.getState().setPageMetadata(meta);

      if (meta.ogVideo) {
        this.observeUrl(meta.ogVideo, meta.pageUrl);
      }
    }
  }

  private handleCandidate(payload: BridgeMediaCandidatePayload): void {
    if (!this.acceptsPageUrl(payload.pageUrl)) {
      return;
    }

    const epoch = this.navigationEpoch;
    const store = useMediaDetectionStore.getState();
    const result = mediaDetectionPipeline.processBridgeCandidate(
      store.detectedMedia,
      payload,
      store.qualities,
    );
    if (!this.isCurrentEpoch(epoch)) {
      return;
    }
    this.applyPipelineResult(result);
    void this.maybeEnrichHls(result, epoch);
  }

  private handleBatch(payload: BridgeMutationBatchPayload): void {
    if (!this.acceptsPageUrl(payload.pageUrl)) {
      return;
    }

    const epoch = this.navigationEpoch;
    const store = useMediaDetectionStore.getState();
    // Avoid scanning-flag thrash: only raise progress if not already complete.
    if (store.scanProgress < 1) {
      store.setScanning(true, Math.max(store.scanProgress, 0.7));
    }
    const result = mediaDetectionPipeline.processBridgeBatch(
      store.detectedMedia,
      payload,
      store.qualities,
    );
    if (!this.isCurrentEpoch(epoch)) {
      return;
    }
    this.applyPipelineResult(result);
    store.setScanning(false, 1);
    void this.maybeEnrichHls(result, epoch);
    this.debouncedRescanNotify();
  }

  private applyPipelineResult(result: PipelineResult): void {
    if (!this.pageUrl) {
      return;
    }

    const store = useMediaDetectionStore.getState();

    if (result.media !== store.detectedMedia) {
      useMediaDetectionStore.setState({
        detectedMedia: result.media,
        videoFormats: result.media.filter((m) => m.category === 'video'),
        audioFormats: result.media.filter((m) => m.category === 'audio'),
        streamFormats: result.media.filter((m) => m.category === 'stream'),
        confidence:
          result.media.length === 0
            ? 0
            : Number(
                (
                  result.media.reduce((s, m) => s + m.confidence, 0) /
                  result.media.length
                ).toFixed(3),
              ),
        lastScan: Date.now(),
        statistics: {
          ...store.statistics,
          totalDetected: result.media.length,
          videoCount: result.media.filter((m) => m.category === 'video').length,
          audioCount: result.media.filter((m) => m.category === 'audio').length,
          streamCount: result.media.filter((m) => m.category === 'stream').length,
          duplicateUpdates:
            store.statistics.duplicateUpdates + result.updated,
          rejectedCount: store.statistics.rejectedCount + result.rejected,
          lastScanDurationMs: result.durationMs,
          scansCompleted: store.statistics.scansCompleted + 1,
        },
      });
    } else if (result.rejected > 0) {
      store.bumpStatistics({
        rejectedCount: store.statistics.rejectedCount + result.rejected,
        lastScanDurationMs: result.durationMs,
      });
    }

    if (result.qualities.length) {
      store.upsertQualities(result.qualities);
    }
  }

  private async maybeEnrichHls(
    result: PipelineResult,
    epoch: number,
  ): Promise<void> {
    const pageAtStart = this.pageUrl;
    if (!pageAtStart) {
      return;
    }

    const streams = result.media.filter(
      (m) => m.container === 'hls' && !m.isDrm,
    );
    for (const stream of streams.slice(0, 3)) {
      try {
        const enriched = await mediaDetectionPipeline.enrichHlsMedia(stream);
        if (!enriched) {
          continue;
        }
        if (
          !this.isCurrentEpoch(epoch) ||
          !this.pageUrl ||
          !isSameDocumentUrl(pageAtStart, this.pageUrl) ||
          mediaDetectionPipeline.signal?.aborted
        ) {
          return;
        }
        if (!isSameDocumentUrl(enriched.media.pageUrl, this.pageUrl)) {
          continue;
        }

        useMediaDetectionStore.getState().upsertMedia(enriched.media);
        if (enriched.qualities.length) {
          useMediaDetectionStore.getState().upsertQualities(enriched.qualities);
        }
        if (enriched.media.isDrm) {
          useMediaDetectionStore.getState().setDetectionError({
            code: 'encrypted_hls',
            message: 'Encrypted HLS stream detected — download not supported.',
            url: enriched.media.url,
            occurredAt: Date.now(),
          });
        }
      } catch {
        // Isolation — enrichment failures must never crash browsing.
      }
    }
  }

  private acceptsPageUrl(pageUrl: string | null | undefined): boolean {
    if (!this.pageUrl || !pageUrl) {
      return false;
    }
    return isSameDocumentUrl(pageUrl, this.pageUrl);
  }

  private isCurrentEpoch(epoch: number): boolean {
    return epoch === this.navigationEpoch;
  }
}

export const mediaDetectionEngine = new MediaDetectionEngine();
