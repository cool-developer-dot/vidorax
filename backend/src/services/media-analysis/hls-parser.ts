/**
 * Lightweight HLS manifest parser for Analyze.
 * Distinguishes master vs media playlists. Does not download segments.
 * Tolerates UTF-8 BOM, CRLF/LF, and blank lines.
 */

export const HLS_MAX_VARIANTS = 64;
export const HLS_MAX_EXTINF_ENTRIES = 5_000;

export type HlsPlaylistType = 'master' | 'variant' | 'media' | 'unknown';

export type HlsVariant = {
  uri: string;
  bandwidth: number | null;
  averageBandwidth: number | null;
  width: number | null;
  height: number | null;
  codecs: string | null;
  frameRate: number | null;
};

export type HlsParseResult = {
  playlistType: HlsPlaylistType;
  isMaster: boolean;
  isMedia: boolean;
  isEncrypted: boolean;
  isDrm: boolean;
  hasByteRange: boolean;
  isLive: boolean;
  /** Sum of EXTINF durations when reliably parsed from a media playlist. */
  durationSeconds: number | null;
  variants: HlsVariant[];
};

const MAX_DIMENSION = 16_384;

/**
 * Parse HLS attributes with quoted-value support (CODECS may contain commas).
 */
export const parseAttributeList = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!raw) {
    return result;
  }

  const regex = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/gi;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match) {
    const key = match[1]?.toUpperCase();
    const value = match[3] ?? match[2];
    if (key && value != null) {
      result[key] = value.trim();
    }
    match = regex.exec(raw);
  }
  return result;
};

const parsePositiveInt = (raw: string | undefined): number | null => {
  if (raw == null || raw === '') {
    return null;
  }
  if (!/^\d+$/.test(raw.trim())) {
    return null;
  }
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    return null;
  }
  return value;
};

const parsePositiveDimension = (raw: string | undefined): number | null => {
  const value = parsePositiveInt(raw);
  if (value == null || value > MAX_DIMENSION) {
    return null;
  }
  return value;
};

const parseResolution = (
  raw: string | undefined,
): { width: number | null; height: number | null } => {
  if (!raw) {
    return { width: null, height: null };
  }
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(raw.trim());
  if (!match) {
    return { width: null, height: null };
  }
  return {
    width: parsePositiveDimension(match[1]),
    height: parsePositiveDimension(match[2]),
  };
};

const parseFrameRate = (raw: string | undefined): number | null => {
  if (raw == null || raw === '') {
    return null;
  }
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0 || value > 240) {
    return null;
  }
  return value;
};

const stripBom = (content: string): string =>
  content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

type KeyInspection = 'none' | 'encryption' | 'drm';

const inspectKeyTag = (line: string): KeyInspection => {
  const trimmed = line.trim();
  if (
    !trimmed.startsWith('#EXT-X-KEY:') &&
    !trimmed.startsWith('#EXT-X-SESSION-KEY:')
  ) {
    return 'none';
  }
  const attrs = parseAttributeList(trimmed.slice(trimmed.indexOf(':') + 1));
  const method = (attrs.METHOD ?? '').toUpperCase();
  if (!method || method === 'NONE') {
    return 'none';
  }
  const keyFormat = (attrs.KEYFORMAT ?? '').toLowerCase();
  if (
    keyFormat.includes('com.apple.streamingkeydelivery') ||
    keyFormat.includes('urn:uuid') ||
    keyFormat.includes('widevine') ||
    keyFormat.includes('playready') ||
    keyFormat.includes('clearkey') ||
    keyFormat.includes('com.microsoft.playready')
  ) {
    return 'drm';
  }
  if (
    method === 'SAMPLE-AES' ||
    method === 'SAMPLE-AES-CTR' ||
    method === 'AES-128'
  ) {
    return 'encryption';
  }
  return 'drm';
};

const inspectPlaylistProtection = (
  lines: string[],
): { isEncrypted: boolean; isDrm: boolean; hasByteRange: boolean } => {
  let isEncrypted = false;
  let isDrm = false;
  let hasByteRange = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const keyKind = inspectKeyTag(line);
    if (keyKind === 'drm') {
      isDrm = true;
    }
    if (keyKind === 'encryption') {
      isEncrypted = true;
    }
    if (line.startsWith('#EXT-X-BYTERANGE')) {
      hasByteRange = true;
    }
    if (line.startsWith('#EXT-X-MAP:') && /BYTERANGE=/i.test(line)) {
      hasByteRange = true;
    }
  }

  return { isEncrypted, isDrm, hasByteRange };
};

/**
 * Sum EXTINF durations from a media playlist with hard entry/byte safety.
 * Returns null when no usable durations exist.
 */
export const parseMediaPlaylistDuration = (content: string): number | null => {
  const lines = stripBom(content).split(/\r?\n/);
  let total = 0;
  let count = 0;
  let found = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('#EXTINF:')) {
      continue;
    }
    count += 1;
    if (count > HLS_MAX_EXTINF_ENTRIES) {
      break;
    }
    const payload = line.slice('#EXTINF:'.length);
    const durationToken = payload.split(',')[0]?.trim();
    if (!durationToken) {
      continue;
    }
    const seconds = Number(durationToken);
    if (!Number.isFinite(seconds) || seconds < 0) {
      continue;
    }
    total += seconds;
    found = true;
  }

  if (!found || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return total;
};

export const parseHlsManifest = (
  content: string,
  manifestUrl: string,
  options: { maxVariants?: number } = {},
): HlsParseResult | null => {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const maxVariants = options.maxVariants ?? HLS_MAX_VARIANTS;
  const trimmed = stripBom(content).trim();
  if (!trimmed.startsWith('#EXTM3U')) {
    return null;
  }

  const lines = trimmed.split(/\r?\n/);
  const isMaster = lines.some((line) =>
    line.trimStart().startsWith('#EXT-X-STREAM-INF'),
  );
  const hasTargetDuration = lines.some((line) =>
    line.trimStart().startsWith('#EXT-X-TARGETDURATION'),
  );
  const hasEndList = lines.some((line) =>
    line.trimStart().startsWith('#EXT-X-ENDLIST'),
  );
  const protection = inspectPlaylistProtection(lines);

  let playlistType: HlsPlaylistType = 'unknown';
  if (isMaster) {
    playlistType = 'master';
  } else if (hasTargetDuration) {
    playlistType = 'media';
  }

  const variants: HlsVariant[] = [];

  if (isMaster) {
    for (let i = 0; i < lines.length; i += 1) {
      if (variants.length >= maxVariants) {
        break;
      }

      const line = lines[i]?.trimStart();
      if (!line?.startsWith('#EXT-X-STREAM-INF')) {
        continue;
      }

      const attrRaw = line.includes(':')
        ? line.slice(line.indexOf(':') + 1)
        : '';
      const attrs = parseAttributeList(attrRaw);

      // Skip blank / comment lines to find the URI that follows STREAM-INF.
      let uriLine: string | null = null;
      for (let j = i + 1; j < lines.length; j += 1) {
        const candidate = lines[j]?.trim();
        if (!candidate) {
          continue;
        }
        if (candidate.startsWith('#')) {
          break;
        }
        uriLine = candidate;
        i = j;
        break;
      }

      if (!uriLine) {
        continue;
      }

      let absoluteUri: string;
      try {
        absoluteUri = new URL(uriLine, manifestUrl).toString();
      } catch {
        continue;
      }

      const { width, height } = parseResolution(attrs.RESOLUTION);
      const bandwidth = parsePositiveInt(attrs.BANDWIDTH);
      const averageBandwidth = parsePositiveInt(attrs['AVERAGE-BANDWIDTH']);
      const frameRate = parseFrameRate(attrs['FRAME-RATE']);
      const codecsRaw = attrs.CODECS?.replace(/^"|"$/g, '').trim() || null;

      variants.push({
        uri: absoluteUri,
        bandwidth,
        averageBandwidth,
        width,
        height,
        codecs: codecsRaw,
        frameRate,
      });
    }
  }

  const durationSeconds =
    !isMaster && hasTargetDuration
      ? parseMediaPlaylistDuration(trimmed)
      : null;

  return {
    playlistType,
    isMaster,
    isMedia: !isMaster && hasTargetDuration,
    isEncrypted: protection.isEncrypted,
    isDrm: protection.isDrm,
    hasByteRange: protection.hasByteRange,
    isLive: hasTargetDuration && !hasEndList,
    durationSeconds,
    variants,
  };
};
