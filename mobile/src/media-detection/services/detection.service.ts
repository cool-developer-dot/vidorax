import { DETECTION_TIMING } from '../constants';
import {
  extractDetectedMedia,
  extractFromDomCandidate,
  extractPageMetadata,
} from '../extractors';
import {
  isDashManifestUrl,
  mapHlsVariantsToQualities,
  parseProgressiveMediaUrl,
} from '../parsers';
import type {
  BridgeMediaCandidatePayload,
  BridgeMutationBatchPayload,
  BridgePageMetaPayload,
  DetectedMedia,
  MediaCandidate,
  MediaQualityVariant,
  PageMediaMetadata,
} from '../types';
import { validateMediaCandidate, isAcceptableConfidence } from '../validators';
import { dedupeUpsert } from './deduplication.service';
import { enrichHlsFromUrl } from './manifest.service';

export type PipelineResult = {
  media: DetectedMedia[];
  qualities: MediaQualityVariant[];
  pageMetadata: PageMediaMetadata | null;
  inserted: number;
  updated: number;
  rejected: number;
  durationMs: number;
};

/**
 * Event-driven detection pipeline:
 * Page Inspection → Discovery → Metadata → Validation → Dedup → Store sync prep
 */
export class MediaDetectionPipeline {
  private abortController: AbortController | null = null;
  private enriching = new Set<string>();

  reset(): void {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.enriching.clear();
  }

  get signal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  processCandidates(
    existing: DetectedMedia[],
    candidates: MediaCandidate[],
    existingQualities: MediaQualityVariant[] = [],
  ): PipelineResult {
    const started = Date.now();
    let items = existing;
    let qualities = existingQualities;
    let inserted = 0;
    let updated = 0;
    let rejected = 0;

    for (const raw of candidates) {
      const validated = validateMediaCandidate(raw);
      if (!validated.ok) {
        rejected += 1;
        continue;
      }

      const detected = extractDetectedMedia(validated.value);
      if (!detected || !isAcceptableConfidence(detected.confidence)) {
        rejected += 1;
        continue;
      }

      const result = dedupeUpsert(
        items,
        detected,
        DETECTION_TIMING.maxDetectedPerPage,
      );
      items = result.items;
      if (result.inserted) {
        inserted += 1;
      }
      if (result.updated) {
        updated += 1;
      }
    }

    return {
      media: items,
      qualities,
      pageMetadata: null,
      inserted,
      updated,
      rejected,
      durationMs: Date.now() - started,
    };
  }

  processBridgeBatch(
    existing: DetectedMedia[],
    batch: BridgeMutationBatchPayload,
    existingQualities: MediaQualityVariant[] = [],
  ): PipelineResult {
    const candidates: MediaCandidate[] = [];

    for (const payload of batch.candidates.slice(
      0,
      DETECTION_TIMING.maxCandidatesPerBatch,
    )) {
      const candidate = extractFromDomCandidate(payload);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    return this.processCandidates(existing, candidates, existingQualities);
  }

  processBridgeCandidate(
    existing: DetectedMedia[],
    payload: BridgeMediaCandidatePayload,
    existingQualities: MediaQualityVariant[] = [],
  ): PipelineResult {
    const candidate = extractFromDomCandidate(payload);
    if (!candidate) {
      return {
        media: existing,
        qualities: existingQualities,
        pageMetadata: null,
        inserted: 0,
        updated: 0,
        rejected: 1,
        durationMs: 0,
      };
    }
    return this.processCandidates(existing, [candidate], existingQualities);
  }

  processPageMeta(payload: BridgePageMetaPayload): PageMediaMetadata | null {
    return extractPageMetadata(payload);
  }

  processNetworkUrl(
    existing: DetectedMedia[],
    url: string,
    pageUrl: string,
    existingQualities: MediaQualityVariant[] = [],
  ): PipelineResult {
    // Architecture: DASH recognized but not ingested in MVP.
    if (isDashManifestUrl(url)) {
      return {
        media: existing,
        qualities: existingQualities,
        pageMetadata: null,
        inserted: 0,
        updated: 0,
        rejected: 0,
        durationMs: 0,
      };
    }

    const candidate = parseProgressiveMediaUrl({
      url,
      pageUrl,
      detectionSource: 'network_request',
    });

    if (!candidate) {
      return {
        media: existing,
        qualities: existingQualities,
        pageMetadata: null,
        inserted: 0,
        updated: 0,
        rejected: 1,
        durationMs: 0,
      };
    }

    return this.processCandidates(existing, [candidate], existingQualities);
  }

  /**
   * Lazy HLS enrichment — fetches manifest off the critical path.
   */
  async enrichHlsMedia(
    media: DetectedMedia,
  ): Promise<{ media: DetectedMedia; qualities: MediaQualityVariant[] } | null> {
    if (media.container !== 'hls' || media.isDrm) {
      return null;
    }

    if (this.enriching.has(media.id)) {
      return null;
    }

    this.enriching.add(media.id);
    try {
      const parsed = await enrichHlsFromUrl(media.url, this.signal);
      if (!parsed) {
        return null;
      }

      if (parsed.isEncrypted) {
        return {
          media: {
            ...media,
            isDrm: true,
            playlistType: parsed.playlistType,
            isLive: parsed.isLive,
          },
          qualities: [],
        };
      }

      const qualities = mapHlsVariantsToQualities(media.id, parsed.variants);
      return {
        media: {
          ...media,
          playlistType: parsed.playlistType,
          isLive: parsed.isLive,
          confidence: Math.min(0.99, media.confidence + 0.1),
        },
        qualities,
      };
    } finally {
      this.enriching.delete(media.id);
    }
  }
}

export const mediaDetectionPipeline = new MediaDetectionPipeline();
