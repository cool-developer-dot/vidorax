import type { HlsPlaylistType, MediaQualityVariant } from '../types';
import { buildMediaId, isSafeMediaUrl, normalizeMediaUrl } from '../utils';

export type HlsParseResult = {
  playlistType: HlsPlaylistType;
  isMaster: boolean;
  isMedia: boolean;
  isEncrypted: boolean;
  isLive: boolean;
  variants: {
    uri: string;
    bandwidth: number | null;
    width: number | null;
    height: number | null;
    codecs: string | null;
  }[];
  /** Architecture placeholder — DASH/CMAF not implemented. */
  reservedProtocols: {
    dash: false;
    cmaf: false;
  };
};

/**
 * Lightweight HLS parser for master / media playlists.
 * Does not download segments. Flags encryption when EXT-X-KEY present.
 */
export function parseHlsManifest(
  content: string,
  manifestUrl: string,
): HlsParseResult | null {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const trimmed = content.trim();
  if (!trimmed.startsWith('#EXTM3U')) {
    return null;
  }

  const lines = trimmed.split(/\r?\n/);
  const isMaster = lines.some((line) => line.startsWith('#EXT-X-STREAM-INF'));
  const hasTargetDuration = lines.some((line) =>
    line.startsWith('#EXT-X-TARGETDURATION'),
  );
  const hasEndList = lines.some((line) => line.startsWith('#EXT-X-ENDLIST'));
  const isEncrypted = lines.some((line) => line.startsWith('#EXT-X-KEY'));

  let playlistType: HlsPlaylistType = 'unknown';
  if (isMaster) {
    playlistType = 'master';
  } else if (hasTargetDuration) {
    playlistType = 'media';
  }

  const variants: HlsParseResult['variants'] = [];

  if (isMaster) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line?.startsWith('#EXT-X-STREAM-INF')) {
        continue;
      }

      const attrs = parseAttributeList(line.slice('#EXT-X-STREAM-INF:'.length));
      const next = lines[i + 1]?.trim();
      if (!next || next.startsWith('#')) {
        continue;
      }

      let absoluteUri = next;
      try {
        absoluteUri = new URL(next, manifestUrl).toString();
      } catch {
        continue;
      }

      if (!isSafeMediaUrl(absoluteUri)) {
        continue;
      }
      const safeUri = normalizeMediaUrl(absoluteUri);
      if (!safeUri) {
        continue;
      }

      const resolution = attrs.RESOLUTION?.split('x');
      const width = resolution?.[0] ? Number(resolution[0]) : null;
      const height = resolution?.[1] ? Number(resolution[1]) : null;

      variants.push({
        uri: safeUri,
        bandwidth: attrs.BANDWIDTH ? Number(attrs.BANDWIDTH) : null,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        codecs: attrs.CODECS?.replace(/^"|"$/g, '') ?? null,
      });
    }
  }

  return {
    playlistType,
    isMaster,
    isMedia: !isMaster && hasTargetDuration,
    isEncrypted,
    isLive: hasTargetDuration && !hasEndList,
    variants,
    reservedProtocols: { dash: false, cmaf: false },
  };
}

export function mapHlsVariantsToQualities(
  mediaId: string,
  variants: HlsParseResult['variants'],
): MediaQualityVariant[] {
  return variants
    .filter((variant) => isSafeMediaUrl(variant.uri))
    .map((variant) => ({
      id: buildMediaId({
        url: variant.uri,
        bitrate: variant.bandwidth,
        width: variant.width,
        height: variant.height,
        streamProtocol: 'hls',
        playlistType: 'variant',
      }),
      mediaId,
      bandwidth: variant.bandwidth,
      width: variant.width,
      height: variant.height,
      resolution:
        variant.width && variant.height
          ? `${variant.width}x${variant.height}`
          : null,
      codecs: variant.codecs,
      url: variant.uri,
      playlistType: 'variant' as const,
    }));
}

function parseAttributeList(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/gi;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match) {
    const key = match[1]?.toUpperCase();
    const value = match[3] ?? match[2];
    if (key && value != null) {
      result[key] = value;
    }
    match = regex.exec(raw);
  }
  return result;
}

/**
 * Architecture stub — DASH manifests are recognized but not parsed in MVP.
 */
export function isDashManifestUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith('.mpd');
  } catch {
    return false;
  }
}

/**
 * Architecture stub — CMAF is prepared but not implemented.
 */
export function isCmafHint(_url: string): boolean {
  return false;
}
