import { AccessibilityInfo } from 'react-native';
import { isApiError, analyzeDownload, type MediaAnalysisResult } from '@/api';
import {
  findQualityOptionById,
  normalizeAnalysisToSelection,
  selectDefaultQualityOption,
  toCreateDownloadInput,
  unsupportedReasonCopy,
  type AnalyzedMediaSelection,
  type QualityOption,
  type QualitySelectionPhase,
} from '@/downloads/quality';
import { isSafeMediaUrl } from '@/media-detection/utils';
import { useDownloadsStore } from '@/store/downloads';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { translate } from '@/localization';


function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const maybe = error as { name?: string; code?: string; message?: string };
  if (maybe.name === 'CanceledError' || maybe.name === 'AbortError') {
    return true;
  }
  if (maybe.code === 'ERR_CANCELED') {
    return true;
  }
  return typeof maybe.message === 'string' && /cancel|abort/i.test(maybe.message);
}

function mapAnalyzeError(error: unknown): string {
  if (isApiError(error)) {
    if (error.isUnauthorized) {
      return translate('errors.unauthorized');
    }
    if (error.isNetworkError) {
      return translate('errors.network');
    }
    if (error.isValidationError) {
      return error.message || translate('downloads.invalidUrl');
    }
    return error.message || translate('downloads.qualityErrorTitle');
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return translate('downloads.qualityErrorTitle');
}

function validatePasteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return translate('downloads.missingUrl');
  }
  if (!isSafeMediaUrl(trimmed)) {
    return translate('downloads.invalidUrl');
  }
  return null;
}

export type UseQualitySelectionResult = {
  visible: boolean;
  url: string;
  urlError: string | null;
  phase: QualitySelectionPhase;
  selection: AnalyzedMediaSelection | null;
  selectedId: string | null;
  selectedOption: QualityOption | null;
  errorMessage: string | null;
  emptyMessage: string | null;
  creating: boolean;
  createError: string | null;
  analyzing: boolean;
  open: () => void;
  /** Prefill URL and run Analyze once — Browser Download CTA entry. */
  openWithUrl: (url: string) => Promise<void>;
  close: () => void;
  setUrl: (value: string) => void;
  pasteUrl: (value: string) => void;
  analyze: () => Promise<void>;
  retry: () => Promise<void>;
  resetToInput: () => void;
  selectOption: (id: string) => void;
  confirmDownload: () => Promise<boolean>;
};

/**
 * Paste → analyze → select → create download.
 * Owns local selection only; job creation goes through the existing downloads store.
 */
export function useQualitySelection(
  options?: {
    onDownloadCreated?: () => void;
  },
): UseQualitySelectionResult {
  const create = useDownloadsStore((state) => state.create);
  const onDownloadCreated = options?.onDownloadCreated;

  const [visible, setVisible] = useState(false);
  const [url, setUrlState] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [phase, setPhase] = useState<QualitySelectionPhase>('idle');
  const [selection, setSelection] = useState<AnalyzedMediaSelection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const analyzingRef = useRef(false);
  const creatingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const resetTransient = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    analyzingRef.current = false;
    creatingRef.current = false;
    setPhase('idle');
    setSelection(null);
    setSelectedId(null);
    setErrorMessage(null);
    setCreateError(null);
    setCreating(false);
    setUrlError(null);
  }, []);

  const open = useCallback(() => {
    resetTransient();
    setUrlState('');
    setVisible(true);
  }, [resetTransient]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setVisible(false);
    resetTransient();
    setUrlState('');
  }, [resetTransient]);

  const setUrl = useCallback((value: string) => {
    setUrlState(value);
    setUrlError(null);
  }, []);

  const pasteUrl = useCallback((value: string) => {
    setUrlState(value.trim());
    setUrlError(null);
  }, []);

  const applyAnalysis = useCallback((analysis: MediaAnalysisResult) => {
    const next = normalizeAnalysisToSelection(analysis);
    const defaultOption = selectDefaultQualityOption(next.options);
    setSelection(next);
    setSelectedId(defaultOption?.id ?? null);

    const hasDownloadable = next.options.some((option) => option.downloadable);
    if (!hasDownloadable) {
      setPhase('empty');
      return;
    }

    setPhase('ready');
  }, []);

  const runAnalyze = useCallback(
    async (rawUrl: string) => {
      if (analyzingRef.current || creatingRef.current) {
        return;
      }

      const validationError = validatePasteUrl(rawUrl);
      if (validationError) {
        setUrlError(validationError);
        return;
      }

      const trimmed = rawUrl.trim();

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      analyzingRef.current = true;

      setPhase('analyzing');
      setErrorMessage(null);
      setCreateError(null);
      setSelection(null);
      setSelectedId(null);
      setUrlError(null);

      try {
        const analysis = await analyzeDownload(
          { url: trimmed },
          { signal: controller.signal },
        );

        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        applyAnalysis(analysis);
      } catch (error) {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        if (isAbortError(error) || controller.signal.aborted) {
          return;
        }

        setPhase('error');
        setErrorMessage(mapAnalyzeError(error));
      } finally {
        if (requestId === requestIdRef.current) {
          analyzingRef.current = false;
        }
      }
    },
    [applyAnalysis],
  );

  const openWithUrl = useCallback(
    async (rawUrl: string) => {
      if (analyzingRef.current || creatingRef.current) {
        return;
      }
      const trimmed = rawUrl.trim();
      resetTransient();
      setUrlState(trimmed);
      setVisible(true);
      await runAnalyze(trimmed);
    },
    [resetTransient, runAnalyze],
  );

  const analyze = useCallback(async () => {
    await runAnalyze(url);
  }, [runAnalyze, url]);

  const retry = useCallback(async () => {
    await runAnalyze(url);
  }, [runAnalyze, url]);

  const resetToInput = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    analyzingRef.current = false;
    creatingRef.current = false;
    setPhase('idle');
    setSelection(null);
    setSelectedId(null);
    setErrorMessage(null);
    setCreateError(null);
    setCreating(false);
  }, []);

  const selectOption = useCallback(
    (id: string) => {
      if (!selection || creatingRef.current) {
        return;
      }
      const option = findQualityOptionById(selection.options, id);
      if (!option) {
        return;
      }
      setSelectedId(option.id);
      setCreateError(null);
    },
    [selection],
  );

  const selectedOption = useMemo(
    () => (selection != null ? findQualityOptionById(selection.options, selectedId) : null),
    [selection, selectedId],
  );

  const emptyMessage = useMemo(() => {
    if (phase !== 'empty') {
      return null;
    }
    const unsupportedFromOption = selection?.options.find(
      (option) => !option.downloadable,
    )?.unavailableReason;
    return unsupportedReasonCopy(
      unsupportedFromOption ?? selection?.unsupportedReason ?? null,
    );
  }, [phase, selection]);

  const confirmDownload = useCallback(async () => {
    if (creatingRef.current || analyzingRef.current) {
      return false;
    }

    if (!selection || !selectedOption) {
      setCreateError(translate('downloads.selectionHint'));
      return false;
    }

    if (!selectedOption.downloadable) {
      setCreateError(translate('downloads.selectionHint'));
      return false;
    }

    const payload = toCreateDownloadInput(selection, selectedOption);
    if (!payload) {
      setCreateError(translate('downloads.selectionHint'));
      return false;
    }

    creatingRef.current = true;
    setCreating(true);
    setCreateError(null);

    try {
      const created = await create(payload);
      if (!mountedRef.current) {
        return false;
      }

      if (!created) {
        const storeError = useDownloadsStore.getState().error;
        setCreateError(storeError?.trim() || 'Couldn’t start this download.');
        return false;
      }

      AccessibilityInfo.announceForAccessibility('Download added');
      onDownloadCreated?.();
      close();
      return true;
    } catch {
      if (mountedRef.current) {
        setCreateError('Couldn’t start this download.');
      }
      return false;
    } finally {
      creatingRef.current = false;
      if (mountedRef.current) {
        setCreating(false);
      }
    }
  }, [close, create, onDownloadCreated, selectedOption, selection]);

  return {
    visible,
    url,
    urlError,
    phase,
    selection,
    selectedId,
    selectedOption,
    errorMessage,
    emptyMessage,
    creating,
    createError,
    analyzing: phase === 'analyzing',
    open,
    openWithUrl,
    close,
    setUrl,
    pasteUrl,
    analyze,
    retry,
    resetToInput,
    selectOption,
    confirmDownload,
  };
}
