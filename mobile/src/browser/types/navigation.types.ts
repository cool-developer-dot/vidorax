/**
 * Result of classifying free-form omnibox input before navigation.
 */
export type NavigationInputCategory =
  | 'empty'
  | 'search'
  | 'domain'
  | 'www_domain'
  | 'https_url'
  | 'http_url'
  | 'ip'
  | 'localhost'
  | 'home'
  | 'invalid'
  | 'blocked';

export type NavigationIntent =
  | { kind: 'empty' }
  | { kind: 'home' }
  | {
      kind: 'navigate';
      url: string;
      category: Extract<
        NavigationInputCategory,
        'domain' | 'www_domain' | 'https_url' | 'http_url' | 'ip' | 'localhost'
      >;
    }
  | { kind: 'search'; url: string; query: string }
  | { kind: 'invalid'; message: string; category: 'invalid' }
  | { kind: 'blocked'; message: string; category: 'blocked' };

export type BrowserSecurityLevel = 'secure' | 'insecure' | 'neutral' | 'warning';

export type BrowserErrorCode =
  | 'invalid_url'
  | 'load_failed'
  | 'network_failure'
  | 'timeout'
  | 'ssl_error'
  | 'http_error'
  | 'unsupported'
  | 'process_terminated'
  | 'unknown';

export interface BrowserErrorState {
  code: BrowserErrorCode;
  title: string;
  message: string;
  url: string | null;
  statusCode?: number;
}
