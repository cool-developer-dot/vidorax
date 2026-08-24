import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { selectIsHome, useBrowserStore } from '@/browser/stores';

import { resolveAudioOptions, resolveQualities, type ResolvedQuality } from '../quality';
import {
  useDiscoveryUiStore,
  useMediaDetectionStore,
} from '../stores';
import type { DetectedMedia } from '../types';
import { isDownloadAffordable, resolveDiscoveryBadges, type DiscoveryBadge } from '../ui';

export type MediaDiscoveryViewModel = {
  visible: boolean;
  media: DetectedMedia | null;
  candidates: DetectedMedia[];
  /** All detected ids on the page (including dismissed) — used for session dismiss. */
  allDetectedIds: string[];
  qualities: ResolvedQuality[];
  audioOptions: ReturnType<typeof resolveAudioOptions>;
  badges: DiscoveryBadge[];
  isScanning: boolean;
  expanded: boolean;
  downloadable: boolean;
  pageTitle: string | null;
  errorMessage: string | null;
  dismiss: () => void;
  toggleExpanded: () => void;
  focusMedia: (id: string) => void;
};

/**
 * Composes detection store + discovery UI store into a presentation model.
 * Clears dismissals on navigation. Hides on home / empty / session dismiss.
 */
export function useMediaDiscovery(): MediaDiscoveryViewModel {
  const isHome = useBrowserStore(selectIsHome);
  const {
    detectedMedia,
    variants,
    isScanning,
    pageMetadata,
    detectionError,
    lastNavigation,
  } = useMediaDetectionStore(
    useShallow((s) => ({
      detectedMedia: s.detectedMedia,
      variants: s.qualities,
      isScanning: s.isScanning,
      pageMetadata: s.pageMetadata,
      detectionError: s.detectionError,
      lastNavigation: s.lastNavigation,
    })),
  );

  const {
    dismissedIds,
    sessionFingerprint,
    sessionDismissed,
    expanded,
    focusedMediaId,
    resetForNavigation,
    dismissSession,
    setExpanded,
    setFocusedMediaId,
  } = useDiscoveryUiStore(
    useShallow((s) => ({
      dismissedIds: s.dismissedIds,
      sessionFingerprint: s.sessionFingerprint,
      sessionDismissed: s.sessionDismissed,
      expanded: s.expanded,
      focusedMediaId: s.focusedMediaId,
      resetForNavigation: s.resetForNavigation,
      dismissSession: s.dismissSession,
      setExpanded: s.setExpanded,
      setFocusedMediaId: s.setFocusedMediaId,
    })),
  );

  useEffect(() => {
    resetForNavigation(lastNavigation);
  }, [lastNavigation, resetForNavigation]);

  const fingerprintSet = useMemo(
    () => new Set(sessionFingerprint),
    [sessionFingerprint],
  );

  const candidates = useMemo(() => {
    return detectedMedia.filter((m) => {
      if (dismissedIds[m.id]) {
        return false;
      }
      // Session dismiss: keep hiding fingerprint ids; allow brand-new detections.
      if (sessionDismissed && fingerprintSet.has(m.id)) {
        return false;
      }
      return true;
    });
  }, [detectedMedia, dismissedIds, sessionDismissed, fingerprintSet]);

  const allDetectedIds = useMemo(
    () => detectedMedia.map((m) => m.id),
    [detectedMedia],
  );

  const media = useMemo(() => {
    if (candidates.length === 0) {
      return null;
    }
    if (focusedMediaId) {
      const focused = candidates.find((m) => m.id === focusedMediaId);
      if (focused) {
        return focused;
      }
    }
    return (
      candidates.find((m) => m.category === 'video') ??
      candidates.find((m) => m.category === 'stream') ??
      candidates[0] ??
      null
    );
  }, [candidates, focusedMediaId]);

  const qualities = useMemo(
    () => (media ? resolveQualities({ media, variants }) : []),
    [media, variants],
  );

  const audioOptions = useMemo(
    () => resolveAudioOptions(candidates),
    [candidates],
  );

  const badges = useMemo(
    () => (media ? resolveDiscoveryBadges(media, detectionError) : []),
    [media, detectionError],
  );

  const visible = !isHome && media != null;

  const dismiss = useCallback(() => {
    // Prefer current page detections; fall back to visible candidates.
    const ids = allDetectedIds.length > 0 ? allDetectedIds : candidates.map((c) => c.id);
    if (ids.length === 0 && media) {
      dismissSession([media.id]);
      return;
    }
    dismissSession(ids);
  }, [allDetectedIds, candidates, media, dismissSession]);

  const toggleExpanded = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded, setExpanded]);

  return {
    visible,
    media,
    candidates,
    allDetectedIds,
    qualities,
    audioOptions,
    badges,
    isScanning,
    expanded,
    downloadable: media ? isDownloadAffordable(media) : false,
    pageTitle: pageMetadata?.title ?? media?.title ?? null,
    errorMessage:
      detectionError && media?.isDrm
        ? detectionError.message
        : detectionError?.code === 'encrypted_hls'
          ? detectionError.message
          : null,
    dismiss,
    toggleExpanded,
    focusMedia: setFocusedMediaId,
  };
}
