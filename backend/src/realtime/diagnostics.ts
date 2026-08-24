type RealtimeDiagLevel = 'info' | 'warn' | 'error';

type RealtimeDiagFields = Record<
  string,
  string | number | boolean | null | undefined
>;

const SENSITIVE_KEYS = new Set([
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'cookies',
  'password',
  'sourceUrl',
  'signedUrl',
]);

function sanitizeFields(fields?: RealtimeDiagFields): RealtimeDiagFields {
  if (!fields) {
    return {};
  }

  const out: RealtimeDiagFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue;
    }
    if (typeof value === 'string' && value.length > 200) {
      out[key] = `${value.slice(0, 200)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function realtimeLog(
  event: string,
  fields?: RealtimeDiagFields,
  level: RealtimeDiagLevel = 'info',
): void {
  if (process.env.NODE_ENV === 'production' && level === 'info') {
    return;
  }
  const payload = {
    scope: 'realtime',
    event,
    ...sanitizeFields(fields),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}
