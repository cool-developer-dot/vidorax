/**
 * Cross-screen browser navigation intent.
 * History (and future surfaces) set a URL here, then navigate to the Browser tab.
 * BrowserScreen consumes the pending URL on focus.
 */
import { navigationService } from '@/browser/services/navigation.service';
import { isBrowserHomeUrl } from '@/browser/utils';

let pendingUrl: string | null = null;

export const pendingNavigationService = {
  set(url: string): void {
    const trimmed = url.trim();
    if (!trimmed) {
      pendingUrl = null;
      return;
    }

    // Only queue URLs the in-app WebView is allowed to open.
    if (!isBrowserHomeUrl(trimmed) && !navigationService.shouldHandleInBrowser(trimmed)) {
      return;
    }

    pendingUrl = trimmed;
  },

  take(): string | null {
    const value = pendingUrl;
    pendingUrl = null;
    return value;
  },

  peek(): string | null {
    return pendingUrl;
  },

  clear(): void {
    pendingUrl = null;
  },
} as const;
