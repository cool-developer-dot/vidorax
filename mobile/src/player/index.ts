export type {
  PlaybackSource,
  PlayerController,
  PlayerErrorCode,
  PlayerSessionPhase,
  PlayerSessionState,
} from './types';
export {
  PROGRESS_INTERVAL_SECONDS,
  SEEK_STEP_SECONDS,
  initialPlayerSessionState,
} from './types';
export {
  PlaybackError,
  classifyNativePlayerError,
  isRecoverablePlayerError,
  normalizePlayerError,
  titleForPlayerError,
  userMessageForPlayerError,
} from './errors';
export { assertSafeMediaId, parseRouteMediaId } from './media-id';
export { clampSeekTarget, seekByDelta } from './seek';
export { formatPlaybackTime } from './format-time';
export {
  emitPlaybackEvent,
  resetPlaybackEventListeners,
  subscribePlaybackEvents,
  type PlaybackContractEvent,
  type PlaybackEventListener,
} from './playback-events';
export {
  configureResolvePlaybackSourceDeps,
  resetResolvePlaybackSourceDeps,
  resolvePlaybackSource,
  type LocalPlaybackRecord,
  type PlaybackFileAssessment,
  type ResolvePlaybackSourceDeps,
  type VerifyPlaybackFileFn,
} from './resolve-playback-source';
export {
  adaptVideoPlayer,
  createPlayerController,
  type PlayerEngineAdapter,
} from './player-controller';
export {
  DEFAULT_PLAYBACK_RATE,
  PLAYBACK_RATES,
  formatPlaybackRateLabel,
  isValidPlaybackRate,
  normalizePlaybackRate,
  type PlaybackRate,
} from './playback-rates';
export {
  applyMute,
  applyUnmute,
  applyVolumeChange,
  clampVolume,
  createInitialVolumeState,
  type VolumeMuteState,
} from './volume-state';
export {
  beginEnterFullscreen,
  beginExitFullscreen,
  completeEnterFullscreen,
  completeExitFullscreen,
  initialFullscreenState,
  resolveAndroidBackAction,
  type FullscreenMachineState,
  type FullscreenPhase,
} from './fullscreen-state';
export {
  CONTROLS_AUTO_HIDE_MS,
  ControlsVisibilityController,
  shouldForceControlsVisible,
  type ControlsVisibilityInput,
} from './controls-visibility';
export {
  SEEK_FEEDBACK_MS,
  doubleTapSeekDelta,
  resolveDoubleTapSide,
  type DoubleTapSeekSide,
} from './double-tap-seek';
export {
  configureOrientationAdapter,
  enterFullscreenOrientation,
  exitFullscreenOrientation,
  getOrientationLockKind,
  resetOrientationControllerForTests,
  restoreOrientation,
} from './orientation-controller';
export {
  configureSystemBarsAdapter,
  enterImmersiveSystemBars,
  exitImmersiveSystemBars,
  isSystemBarsImmersive,
  resetSystemBarsControllerForTests,
  restoreSystemBars,
} from './system-bars';
export {
  decideAppLifecycleAction,
  shouldTreatAsBackground,
} from './app-lifecycle-policy';
export {
  PREPARATION_TIMEOUT_MS,
  PreparationWatchdog,
} from './preparation-watchdog';
export { isCurrentPlayerSession } from './session-generation';
export { playerLog, type PlayerDiagnosticEvent } from './diagnostics';

// Hooks with native deps are NOT exported from the barrel (Node verify safety).
