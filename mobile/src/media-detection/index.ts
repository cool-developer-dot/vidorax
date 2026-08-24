/**
 * VidoraX Media Detection + Discovery
 *
 * Phase 1: Detection engine (discover media — no downloads).
 * Phase 2: Discovery UI (present media — no download queue).
 */

export { MediaDetectionHost, MediaDiscoveryOverlay, DetectionCard } from './components';

export {
  MEDIA_DETECTION_VERSION,
  PROGRESSIVE_VIDEO_EXTENSIONS,
  PROGRESSIVE_AUDIO_EXTENSIONS,
  STREAM_EXTENSIONS,
  DETECTION_TIMING,
} from './constants';

export { mediaDetectionEngine } from './engine';

export {
  useMediaDetectionBridge,
  useMediaDetectionBrowserSync,
  useDetectedMedia,
  useDetectedMediaCount,
  useHasDetectedMedia,
  useIsMediaScanning,
  useSelectedDetectedMedia,
  useVideoFormats,
  useAudioFormats,
  useStreamFormats,
  useDetectionConfidence,
  useMediaDiscovery,
} from './hooks';
export type { MediaDiscoveryViewModel } from './hooks';

export {
  useMediaDetectionStore,
  selectDetectedMedia,
  selectSelectedMedia,
  selectVideoFormats,
  selectAudioFormats,
  selectStreamFormats,
  selectQualities,
  selectPageMetadata,
  selectIsScanning,
  selectScanProgress,
  selectSupported,
  selectDetectionError,
  selectLastScan,
  selectLastNavigation,
  selectStatistics,
  selectConfidence,
  selectDetectedCount,
  selectHasDetectedMedia,
  useDiscoveryUiStore,
  selectDismissedIds,
  selectDiscoveryExpanded,
  selectFocusedMediaId,
} from './stores';

export {
  mediaDetectionPipeline,
  toFutureDownloadContract,
  subscribeDetectionSync,
  notifyBrowserDetectionSync,
} from './services';

export {
  buildMediaDetectionInjectedScript,
  buildMediaDetectionBeforeContentScript,
} from './observers';

export {
  resolveQualities,
  resolveAudioOptions,
  labelFromHeight,
  QUALITY_LADDER,
} from './quality';
export type { ResolvedQuality, AudioExtractionOption, QualityLabel } from './quality';

export type {
  DetectedMedia,
  MediaCandidate,
  MediaCategory,
  MediaContainer,
  MediaDetectionStore,
  MediaQualityVariant,
  PageMediaMetadata,
  DetectionStatistics,
  MediaDetectionError,
} from './types';

export type {
  FutureDownloadMetadataContract,
  FutureDownloadMetadataContract as DownloadMetadataContract,
} from './services';
