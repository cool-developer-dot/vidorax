/**
 * Conservative codec normalization for Analyze variants.
 * Unknown / ambiguous strings stay null — never guess.
 */

export type SplitCodecs = {
  raw: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
};

const normalizeToken = (token: string): string | null => {
  const t = token.trim().toLowerCase();
  if (!t) {
    return null;
  }

  if (t.startsWith('avc1.') || t.startsWith('avc3.') || t === 'avc1' || t === 'avc3') {
    return 'H.264';
  }
  if (t.startsWith('hvc1.') || t.startsWith('hev1.') || t === 'hvc1' || t === 'hev1') {
    return 'HEVC';
  }
  if (t.startsWith('vp09.') || t.startsWith('vp9') || t === 'vp09') {
    return 'VP9';
  }
  if (t.startsWith('av01.') || t === 'av01' || t === 'av1') {
    return 'AV1';
  }
  if (t.startsWith('mp4a.') || t === 'mp4a' || t === 'aac') {
    return 'AAC';
  }
  if (t.startsWith('opus') || t === 'opus') {
    return 'Opus';
  }
  if (t.startsWith('mp3') || t === 'mp3' || t.startsWith('mp4a.40.34')) {
    return 'MP3';
  }

  return null;
};

const isLikelyVideoToken = (token: string): boolean => {
  const t = token.trim().toLowerCase();
  return (
    t.startsWith('avc1') ||
    t.startsWith('avc3') ||
    t.startsWith('hvc1') ||
    t.startsWith('hev1') ||
    t.startsWith('vp09') ||
    t.startsWith('vp9') ||
    t.startsWith('av01') ||
    t.startsWith('av1') ||
    t.startsWith('dvh1') ||
    t.startsWith('dvhe')
  );
};

const isLikelyAudioToken = (token: string): boolean => {
  const t = token.trim().toLowerCase();
  return (
    t.startsWith('mp4a') ||
    t.startsWith('opus') ||
    t.startsWith('ac-3') ||
    t.startsWith('ec-3') ||
    t.startsWith('mp3') ||
    t === 'aac'
  );
};

/**
 * Split a CODECS attribute into video/audio display labels when classification is safe.
 */
export const splitAndNormalizeCodecs = (
  codecs: string | null | undefined,
): SplitCodecs => {
  if (!codecs || typeof codecs !== 'string') {
    return { raw: null, videoCodec: null, audioCodec: null };
  }

  const raw = codecs.trim() || null;
  if (!raw) {
    return { raw: null, videoCodec: null, audioCodec: null };
  }

  const tokens = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  let videoCodec: string | null = null;
  let audioCodec: string | null = null;

  for (const token of tokens) {
    if (isLikelyVideoToken(token) && videoCodec == null) {
      videoCodec = normalizeToken(token);
      continue;
    }
    if (isLikelyAudioToken(token) && audioCodec == null) {
      audioCodec = normalizeToken(token);
      continue;
    }
  }

  return { raw, videoCodec, audioCodec };
};

export const isAudioOnlyCodecs = (codecs: string | null | undefined): boolean => {
  if (!codecs) {
    return false;
  }
  const tokens = codecs
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return false;
  }
  return tokens.every((token) => isLikelyAudioToken(token));
};
