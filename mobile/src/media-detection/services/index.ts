export { MediaDetectionPipeline, mediaDetectionPipeline } from './detection.service';
export type { PipelineResult } from './detection.service';
export { dedupeUpsert } from './deduplication.service';
export { enrichHlsFromUrl, fetchHlsManifestText } from './manifest.service';
export {
  getDetectedMediaSnapshot,
  notifyBrowserDetectionSync,
  subscribeDetectionSync,
  toFutureDownloadContract,
} from './browser-sync.service';
export type { FutureDownloadMetadataContract } from './browser-sync.service';
