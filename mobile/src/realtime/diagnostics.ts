type RealtimeDiagLevel = 'info' | 'warn' | 'error';

type Fields = Record<string, string | number | boolean | null | undefined>;

const BLOCKED = new Set([
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'sourceUrl',
]);

function sanitize(fields?: Fields): Fields {
  if (!fields) {
    return {};
  }
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (BLOCKED.has(k)) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function realtimeClientLog(
  event: string,
  fields?: Fields,
  level: RealtimeDiagLevel = 'info',
): void {
  if (!__DEV__ && level === 'info') {
    return;
  }
  const payload = { scope: 'realtime.client', event, ...sanitize(fields) };
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
