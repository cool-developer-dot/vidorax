export { DOWNLOAD_ENGINE, MAX_CONCURRENT_DOWNLOADS, MAX_AUTO_RETRY_ATTEMPTS } from './constants';
export { downloadEngine } from './manager';
export {
  DownloadEngineError,
  classifyTransferFailure,
  classifyTransferError,
  toUserFacingErrorMessage,
} from './errors';
export {
  openLocalDownload,
  shareLocalDownload,
} from './file-actions';
export {
  openMediaFileById,
  shareMediaFileById,
  renameMediaFileOnDevice,
  deleteMediaFileOnDevice,
  resolvePlayableMediaUri,
} from './media-file-actions';
export {
  canUseCompletedLocalMedia,
  assessLocalFile,
  type LocalFilePresence,
} from './local-file-state';
export {
  decideRecoveryState,
  type RecoveryAction,
  type RecoveryDecision,
  type RecoveryEvidence,
} from './recovery-decision';
export {
  isPlaylistOrStreamUrl,
  isSafeHttpUrl,
  sanitizeFileName,
  resolveDownloadFileName,
  mimeFromFileName,
} from './resource-guard';
export { cleanupHlsWorkspace, parseHlsPlaylist, selectHlsVariant } from './hls';
export {
  evaluateMultiRangeEligibility,
  planByteRanges,
  recommendWorkerCount,
  getGlobalNetworkBudget,
  hasResumableMultiRange,
} from './multi-range';
export {
  parseContentRange,
  validateRangeResumeResponse,
} from './range-validation';
export {
  assertSourceIdentityCompatible,
  probeSourceIdentity,
} from './source-identity';
export {
  assertEnoughDiskSpace,
  assertEnoughDiskSpaceForTransfer,
  verifyCompletedFile,
  verifyPartialForRetry,
} from './file-paths';
export type {
  DownloadEngineErrorCode,
  EnqueueInput,
  EngineEvent,
  HlsTransferState,
  LocalDownloadRecord,
  LocalTransferState,
  MultiRangeTransferState,
  RangeValidators,
  TransferProgressSnapshot,
} from './types';
