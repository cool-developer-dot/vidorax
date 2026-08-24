import { useCallback, useRef, useState } from 'react';
import { Keyboard, type TextInput } from 'react-native';

import { useBrowserEngineContext } from '@/browser/engine';
import { useOmniboxSuggestions } from '@/browser/hooks/useOmniboxSuggestions';
import { navigationService } from '@/browser/services';
import type { OmniboxSuggestion } from '@/browser/suggestions';
import {
  selectCurrentUrl,
  selectIsHome,
  selectIsLoading,
  useBrowserStore,
} from '@/browser/stores';
import { formatDisplayUrl, isBrowserHomeUrl } from '@/browser/utils';
import { translate } from '@/localization';
import { useRecentSearchesStore } from '@/store/recent-searches';

/**
 * Premium omnibox controller.
 * Draft editing stays local until a successful submit / suggestion selection.
 */
export function useAddressBar() {
  const currentUrl = useBrowserStore(selectCurrentUrl);
  const isHome = useBrowserStore(selectIsHome);
  const isLoading = useBrowserStore(selectIsLoading);
  const { loadUrl } = useBrowserEngineContext();
  const recordRecentSearch = useRecentSearchesStore((state) => state.record);
  const inputRef = useRef<TextInput>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const { suggestions, loading: suggestionsLoading, clearSuggestions } =
    useOmniboxSuggestions({
      enabled: isFocused,
      query: draft,
    });

  const displayValue = isFocused
    ? draft
    : isHome
      ? ''
      : formatDisplayUrl(currentUrl);

  const dismissEditing = useCallback(() => {
    setIsFocused(false);
    setValidationMessage(null);
    clearSuggestions();
    Keyboard.dismiss();
    inputRef.current?.blur();
  }, [clearSuggestions]);

  const navigateTo = useCallback(
    (url: string, options?: { recordSearchQuery?: string }) => {
      setValidationMessage(null);
      dismissEditing();
      loadUrl(url);

      if (options?.recordSearchQuery?.trim()) {
        void recordRecentSearch(options.recordSearchQuery.trim());
      }
    },
    [dismissEditing, loadUrl, recordRecentSearch],
  );

  const onChangeText = useCallback((text: string) => {
    setDraft(text);
    setValidationMessage(null);
  }, []);

  const onFocus = useCallback(() => {
    const seed = isBrowserHomeUrl(currentUrl) ? '' : currentUrl;
    setDraft(seed);
    setValidationMessage(null);
    setIsFocused(true);
  }, [currentUrl]);

  const onBlur = useCallback(() => {
    // Keep focus state until explicit dismiss / submit so the overlay can receive taps.
  }, []);

  const clear = useCallback(() => {
    setDraft('');
    setValidationMessage(null);
    inputRef.current?.focus();
  }, []);

  const submit = useCallback(() => {
    const result = navigationService.resolveSubmission(draft);

    if (!result.ok) {
      if (result.intent.kind === 'empty') {
        setValidationMessage(translate('browser.addressEmpty'));
      } else if (result.intent.kind === 'blocked') {
        setValidationMessage(translate('browser.addressBlocked'));
      } else {
        setValidationMessage(translate('browser.addressInvalid'));
      }
      return;
    }

    const shouldRecordSearch = result.intent.kind === 'search';
    navigateTo(result.url, {
      recordSearchQuery: shouldRecordSearch ? draft : undefined,
    });
  }, [draft, navigateTo]);

  const selectSuggestion = useCallback(
    (item: OmniboxSuggestion) => {
      const shouldRecordSearch =
        item.kind === 'search' || item.kind === 'recent_search';

      navigateTo(item.url, {
        recordSearchQuery: shouldRecordSearch
          ? item.kind === 'recent_search'
            ? item.title
            : draft
          : undefined,
      });
    },
    [draft, navigateTo],
  );

  const dismissSuggestions = useCallback(() => {
    dismissEditing();
  }, [dismissEditing]);

  return {
    inputRef,
    value: displayValue,
    draft,
    isFocused,
    isLoading: isLoading && !isHome,
    showClear: isFocused && draft.length > 0,
    showSecurity: !isFocused && !isHome,
    validationMessage,
    suggestions,
    suggestionsLoading,
    showSuggestions: isFocused,
    onChangeText,
    onFocus,
    onBlur,
    clear,
    submit,
    selectSuggestion,
    dismissSuggestions,
  };
}
