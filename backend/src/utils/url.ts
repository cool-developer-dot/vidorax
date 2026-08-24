export class InvalidUrlError extends Error {
  constructor(message = 'A valid URL is required') {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new InvalidUrlError();
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidUrlError();
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new InvalidUrlError('URL must use http or https');
  }

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  // Treat trailing slashes consistently across path and query forms.
  return parsed.toString().replace(/\/$/, '');
};

export const extractHostname = (url: string): string => {
  return new URL(url).hostname.toLowerCase();
};
