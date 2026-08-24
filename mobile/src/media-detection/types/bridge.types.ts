/**
 * Bridge protocol between injected page observers and React Native.
 * Keep payloads small and JSON-serializable.
 */

import type { DetectionSource, HlsPlaylistType } from './media.types';

export const MEDIA_BRIDGE_CHANNEL = 'vidorax-media-detection' as const;

export type MediaBridgeMessageType =
  | 'ready'
  | 'page_meta'
  | 'media_candidate'
  | 'mutation_batch'
  | 'scan_complete'
  | 'error';

export interface MediaBridgeEnvelope<T = unknown> {
  channel: typeof MEDIA_BRIDGE_CHANNEL;
  type: MediaBridgeMessageType;
  payload: T;
  ts: number;
}

export interface BridgePageMetaPayload {
  pageUrl: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  ogVideo: string | null;
  canonicalUrl: string | null;
}

export interface BridgeMediaCandidatePayload {
  url: string;
  pageUrl: string;
  mimeType: string | null;
  extension: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  estimatedFileSize: number | null;
  isLive: boolean;
  isDrm: boolean;
  playlistType: HlsPlaylistType | null;
  detectionSource: DetectionSource;
  tagName: string | null;
}

export interface BridgeMutationBatchPayload {
  candidates: BridgeMediaCandidatePayload[];
  pageUrl: string;
}

export interface BridgeErrorPayload {
  code: string;
  message: string;
}

export type MediaBridgePayload =
  | BridgePageMetaPayload
  | BridgeMediaCandidatePayload
  | BridgeMutationBatchPayload
  | BridgeErrorPayload
  | Record<string, never>;
