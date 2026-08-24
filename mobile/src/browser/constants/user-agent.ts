import { Platform } from 'react-native';

import { BROWSER_USER_AGENT_TOKEN } from './browser.constants';

/**
 * Builds a mobile browser user agent that preserves platform defaults
 * while identifying VidoraX for site analytics and future desktop-mode toggles.
 */
export function buildBrowserUserAgent(baseUserAgent?: string | null): string {
  const platformHint = Platform.select({
    ios: 'Mobile',
    android: 'Mobile',
    default: '',
  });

  const base =
    baseUserAgent && baseUserAgent.trim().length > 0
      ? baseUserAgent.trim()
      : Platform.select({
          ios: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`,
          android: `Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36`,
          default: `Mozilla/5.0 (Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`,
        }) ?? '';

  if (base.includes(BROWSER_USER_AGENT_TOKEN)) {
    return base;
  }

  return `${base} ${BROWSER_USER_AGENT_TOKEN}${platformHint ? ` ${platformHint}` : ''}`.trim();
}
