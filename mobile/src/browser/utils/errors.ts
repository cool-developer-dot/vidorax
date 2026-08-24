import type { BrowserErrorCode, BrowserErrorState } from '@/browser/types';

type ErrorCopy = Pick<BrowserErrorState, 'title' | 'message'>;

const ERROR_COPY: Record<BrowserErrorCode, ErrorCopy> = {
  invalid_url: {
    title: 'Invalid address',
    message: 'That doesn’t look like a valid website. Check the address and try again.',
  },
  load_failed: {
    title: 'Page couldn’t load',
    message: 'Something went wrong while opening this page. Check your connection and try again.',
  },
  network_failure: {
    title: 'No connection',
    message: 'We couldn’t reach this website. Check your network, then try again.',
  },
  timeout: {
    title: 'This is taking too long',
    message: 'The page didn’t respond in time. You can retry or go back home.',
  },
  ssl_error: {
    title: 'Connection isn’t secure',
    message:
      'This site’s security certificate couldn’t be verified. Going back home is the safer choice.',
  },
  http_error: {
    title: 'Page unavailable',
    message: 'The website returned an error. You can retry or choose a different address.',
  },
  unsupported: {
    title: 'Unsupported page',
    message: 'VidoraX can’t open this type of page. Try a standard website address instead.',
  },
  process_terminated: {
    title: 'Page recovered',
    message: 'The page stopped responding and was reloaded.',
  },
  unknown: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Try again in a moment.',
  },
};

export function createBrowserError(
  code: BrowserErrorCode,
  overrides?: Partial<Omit<BrowserErrorState, 'code'>>,
): BrowserErrorState {
  const copy = ERROR_COPY[code];
  return {
    code,
    title: overrides?.title ?? copy.title,
    message: overrides?.message ?? copy.message,
    url: overrides?.url ?? null,
    statusCode: overrides?.statusCode,
  };
}

export function classifyWebViewLoadError(input: {
  description?: string;
  code?: number | string;
  url?: string | null;
}): BrowserErrorState {
  const description = (input.description ?? '').toLowerCase();
  const url = input.url ?? null;

  if (
    description.includes('ssl') ||
    description.includes('cert') ||
    description.includes('trust') ||
    description.includes('secure connection') ||
    description.includes('err_cert') ||
    description.includes('err_ssl')
  ) {
    return createBrowserError('ssl_error', {
      url,
      message: input.description || ERROR_COPY.ssl_error.message,
    });
  }

  if (
    description.includes('timeout') ||
    description.includes('timed out') ||
    description.includes('err_connection_timed_out') ||
    description.includes('err_timed_out')
  ) {
    return createBrowserError('timeout', {
      url,
      message: input.description || ERROR_COPY.timeout.message,
    });
  }

  if (
    description.includes('network') ||
    description.includes('internet') ||
    description.includes('offline') ||
    description.includes('err_internet_disconnected') ||
    description.includes('err_name_not_resolved') ||
    description.includes('err_connection_refused') ||
    description.includes('err_address_unreachable')
  ) {
    return createBrowserError('network_failure', {
      url,
      message: input.description || ERROR_COPY.network_failure.message,
    });
  }

  return createBrowserError('load_failed', {
    url,
    message: input.description || ERROR_COPY.load_failed.message,
  });
}
