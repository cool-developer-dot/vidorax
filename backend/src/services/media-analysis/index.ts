/**
 * Media analysis pipeline for POST /api/downloads/analyze.
 *
 * Analyze → Secure Probe → Progressive/HLS Intelligence →
 * Normalize → Security Recheck → Deduplicate → Sort → Variants
 *
 * Does NOT create DownloadHistory records.
 * Does NOT fabricate quality ladders or metadata.
 */

import type {
  MediaAnalysisResult,
  MediaAnalysisVariant,
} from '../../types/media-analysis.types.js';
import { env } from '../../config/index.js';
import { AppError } from '../../utils/errors/index.js';
import {
  InvalidUrlError,
  normalizeUrl,
} from '../../utils/url.js';
import {
  assertSafeAnalysisUrl,
  isSafeAnalysisUrl,
  sanitizeUrlForLog,
  UnsafeUrlError,
  type UrlSecurityOptions,
} from '../../utils/url-security.js';
import { HLS_MAX_VARIANTS, parseHlsManifest } from './hls-parser.js';
import {
  ANALYSIS_MAX_MANIFEST_BYTES,
  AnalysisNetworkError,
  fetchBoundedText,
  inspectSource,
  type HttpProbeResult,
} from './http-probe.js';
import {
  derivePlatform,
  extractFilenameFromContentDisposition,
  isHlsMimeType,
  isNonMediaDocumentMime,
  isPlaylistOrStreamUrl,
  resolveContainer,
  resolveExtension,
  resolveMediaType,
  resolveMimeType,
} from './media-format.js';
import {
  canonicalizeVariants,
  contentLengthToEstimatedSize,
  estimateHlsFileSizeBytes,
  pickPrimaryVariant,
  type VariantDraft,
} from './variant-pipeline.js';

const analysisSecurity = (): UrlSecurityOptions => ({
  allowLoopback:
    env.nodeEnv !== 'production' &&
    process.env.MEDIA_ANALYSIS_ALLOW_LOOPBACK === '1',
});

const emptyAnalysis = (
  sourceUrl: string,
  overrides: Partial<MediaAnalysisResult> = {},
): MediaAnalysisResult => ({
  title: null,
  sourceUrl,
  finalUrl: sourceUrl,
  thumbnailUrl: null,
  mediaType: null,
  mimeType: null,
  container: 'unknown',
  duration: null,
  width: null,
  height: null,
  resolution: null,
  bitrate: null,
  fps: null,
  fileSize: null,
  platform: derivePlatform(sourceUrl),
  downloadable: false,
  unsupportedReason: 'ANALYSIS_FAILED',
  variants: [],
  ...overrides,
});

const parseFileSize = (contentLength: string | null): string | null => {
  if (!contentLength) {
    return null;
  }
  if (!/^\d+$/.test(contentLength.trim())) {
    return null;
  }
  try {
    const value = BigInt(contentLength.trim());
    if (value < 0n) {
      return null;
    }
    return value.toString();
  } catch {
    return null;
  }
};

const resolveCanonicalUrl = (
  raw: string,
  security: UrlSecurityOptions,
): string => {
  try {
    assertSafeAnalysisUrl(raw, security);
    return normalizeUrl(raw);
  } catch (error) {
    if (error instanceof UnsafeUrlError || error instanceof InvalidUrlError) {
      throw new AppError(error.message, 400);
    }
    throw error;
  }
};

const logAnalysis = (
  event: 'started' | 'completed' | 'failed',
  payload: Record<string, unknown>,
): void => {
  console.info(
    JSON.stringify({
      scope: 'media-analysis',
      event,
      ...payload,
    }),
  );
};

const mapNetworkFailure = (sourceUrl: string): MediaAnalysisResult => {
  return emptyAnalysis(sourceUrl, {
    unsupportedReason: 'NETWORK_ERROR',
  });
};

const assertHttpOk = (probe: HttpProbeResult): void => {
  if (probe.status >= 200 && probe.status < 300) {
    return;
  }

  throw new AnalysisNetworkError(
    'http',
    `Source returned HTTP ${probe.status}`,
    probe.status,
  );
};

const applyPrimarySummary = (
  base: MediaAnalysisResult,
  variants: MediaAnalysisVariant[],
): MediaAnalysisResult => {
  const primary = pickPrimaryVariant(variants);
  const downloadable = variants.some((variant) => variant.downloadable);

  if (!primary) {
    return {
      ...base,
      variants: [],
      downloadable: false,
      unsupportedReason: base.unsupportedReason ?? 'UNSUPPORTED_STREAM',
      width: null,
      height: null,
      resolution: null,
      bitrate: null,
      fps: null,
    };
  }

  return {
    ...base,
    variants,
    downloadable,
    unsupportedReason: downloadable ? null : base.unsupportedReason,
    width: primary.width,
    height: primary.height,
    resolution: primary.resolution,
    bitrate: primary.bitrate,
    fps: primary.frameRate,
    mimeType: primary.mimeType ?? base.mimeType,
    container: primary.container !== 'unknown' ? primary.container : base.container,
    fileSize:
      primary.estimatedFileSize != null
        ? String(primary.estimatedFileSize)
        : base.fileSize,
  };
};

const analyzeHls = async (
  sourceUrl: string,
  finalUrl: string,
  mimeType: string | null,
  security: UrlSecurityOptions,
): Promise<MediaAnalysisResult> => {
  const manifestProbe = await fetchBoundedText(
    finalUrl,
    ANALYSIS_MAX_MANIFEST_BYTES,
    security,
  );
  assertHttpOk(manifestProbe);

  // Relative variant URIs resolve against the final redirected playlist URL.
  const playlistBaseUrl = manifestProbe.finalUrl;
  const parsed = parseHlsManifest(
    manifestProbe.bodyText ?? '',
    playlistBaseUrl,
    { maxVariants: HLS_MAX_VARIANTS },
  );

  const base = emptyAnalysis(sourceUrl, {
    finalUrl: playlistBaseUrl,
    mimeType: mimeType ?? 'application/vnd.apple.mpegurl',
    container: 'hls',
    mediaType: 'stream',
    platform: derivePlatform(playlistBaseUrl),
    downloadable: false,
    unsupportedReason: 'UNSUPPORTED_STREAM',
    variants: [],
  });

  if (!parsed) {
    return base;
  }

  if (parsed.isDrm) {
    return {
      ...base,
      unsupportedReason: 'DRM_PROTECTED',
    };
  }

  if (parsed.isEncrypted) {
    return {
      ...base,
      unsupportedReason: 'ENCRYPTED_MEDIA',
    };
  }

  if (parsed.hasByteRange) {
    return {
      ...base,
      unsupportedReason: 'UNSUPPORTED_STREAM',
    };
  }

  if (parsed.isLive) {
    return {
      ...base,
      unsupportedReason: 'UNSUPPORTED_STREAM',
    };
  }

  const hlsMime = mimeType ?? 'application/vnd.apple.mpegurl';
  const drafts: VariantDraft[] = [];

  if (parsed.isMaster) {
    parsed.variants.forEach((variant, index) => {
      if (!isSafeAnalysisUrl(variant.uri, security)) {
        return;
      }

      let safeUrl: string;
      try {
        assertSafeAnalysisUrl(variant.uri, security);
        safeUrl = normalizeUrl(variant.uri);
      } catch {
        return;
      }

      drafts.push({
        sourceUrl: safeUrl,
        streamType: 'HLS',
        width: variant.width,
        height: variant.height,
        resolution:
          variant.width && variant.height
            ? `${variant.width}x${variant.height}`
            : null,
        bitrate: variant.bandwidth,
        averageBitrate: variant.averageBandwidth,
        codecs: variant.codecs,
        container: 'hls',
        mimeType: hlsMime,
        // Master playlists rarely expose duration — size stays null unless known.
        estimatedFileSize: estimateHlsFileSizeBytes(
          variant.averageBandwidth ?? variant.bandwidth,
          parsed.durationSeconds,
        ),
        frameRate: variant.frameRate,
        downloadable: true,
        unsupportedReason: null,
        originalIndex: index,
      });
    });
  } else if (parsed.isMedia) {
    // Direct media playlist → exactly one canonical option. No fabricated ladder.
    let safeUrl: string;
    try {
      assertSafeAnalysisUrl(playlistBaseUrl, security);
      safeUrl = normalizeUrl(playlistBaseUrl);
    } catch {
      return base;
    }

    drafts.push({
      sourceUrl: safeUrl,
      streamType: 'HLS',
      width: null,
      height: null,
      resolution: null,
      bitrate: null,
      averageBitrate: null,
      codecs: null,
      container: 'hls',
      mimeType: hlsMime,
      estimatedFileSize: null,
      frameRate: null,
      downloadable: true,
      unsupportedReason: null,
      originalIndex: 0,
    });
  }

  const variants = canonicalizeVariants(drafts);
  if (variants.length === 0) {
    return {
      ...base,
      duration: parsed.durationSeconds,
      unsupportedReason: 'UNSUPPORTED_STREAM',
    };
  }

  return applyPrimarySummary(
    {
      ...base,
      duration: parsed.durationSeconds,
      unsupportedReason: null,
    },
    variants,
  );
};

/**
 * Analyze a URL without creating a download record.
 */
export const analyzeUrl = async (rawUrl: string): Promise<MediaAnalysisResult> => {
  const security = analysisSecurity();
  const sourceUrl = resolveCanonicalUrl(rawUrl, security);
  const startedAt = Date.now();

  logAnalysis('started', {
    sourceUrl: sanitizeUrlForLog(sourceUrl),
  });

  try {
    const probe = await inspectSource(sourceUrl, security);
    assertHttpOk(probe);

    const finalUrl = (() => {
      try {
        assertSafeAnalysisUrl(probe.finalUrl, security);
        return normalizeUrl(probe.finalUrl);
      } catch {
        throw new AppError('Final URL after redirects is unsafe', 400);
      }
    })();

    const headerMime = resolveMimeType(null, probe.headers.contentType);
    const extension = resolveExtension(finalUrl, headerMime);
    const container = resolveContainer(extension);
    const mediaType = resolveMediaType(container, extension);
    const mimeType = resolveMimeType(extension, headerMime);
    const fileSize = parseFileSize(probe.headers.contentLength);
    const estimatedFileSize = contentLengthToEstimatedSize(
      probe.headers.contentLength,
    );
    const filename = extractFilenameFromContentDisposition(
      probe.headers.contentDisposition,
    );
    const platform = derivePlatform(finalUrl);

    const looksLikeHls =
      container === 'hls' ||
      isHlsMimeType(headerMime) ||
      isPlaylistOrStreamUrl(finalUrl);

    if (looksLikeHls) {
      const hlsResult = await analyzeHls(
        sourceUrl,
        finalUrl,
        mimeType ?? headerMime,
        security,
      );
      logAnalysis('completed', {
        sourceUrl: sanitizeUrlForLog(sourceUrl),
        mediaType: hlsResult.mediaType,
        container: hlsResult.container,
        downloadable: hlsResult.downloadable,
        variantCount: hlsResult.variants.length,
        streamTypes: [...new Set(hlsResult.variants.map((v) => v.streamType))],
        durationMs: Date.now() - startedAt,
      });
      return hlsResult;
    }

    if (!mediaType || container === 'unknown') {
      const unsupportedReason = isNonMediaDocumentMime(headerMime)
        ? 'NO_MEDIA'
        : headerMime
          ? 'UNSUPPORTED_FORMAT'
          : 'NO_MEDIA';

      const result = emptyAnalysis(sourceUrl, {
        finalUrl,
        title: filename,
        mimeType: headerMime,
        container: 'unknown',
        mediaType: null,
        fileSize,
        platform,
        downloadable: false,
        unsupportedReason,
        variants: [],
      });

      logAnalysis('completed', {
        sourceUrl: sanitizeUrlForLog(sourceUrl),
        mediaType: null,
        downloadable: false,
        unsupportedReason: result.unsupportedReason,
        variantCount: 0,
        durationMs: Date.now() - startedAt,
      });
      return result;
    }

    const streamType =
      mediaType === 'audio' ? 'AUDIO' : ('PROGRESSIVE' as const);

    const variants = canonicalizeVariants([
      {
        sourceUrl: finalUrl,
        streamType,
        width: null,
        height: null,
        resolution: null,
        bitrate: null,
        averageBitrate: null,
        codecs: null,
        container,
        mimeType,
        estimatedFileSize,
        frameRate: null,
        downloadable: true,
        unsupportedReason: null,
        originalIndex: 0,
      },
    ]);

    const result = applyPrimarySummary(
      {
        title: filename,
        sourceUrl,
        finalUrl,
        thumbnailUrl: null,
        mediaType,
        mimeType,
        container,
        duration: null,
        width: null,
        height: null,
        resolution: null,
        bitrate: null,
        fps: null,
        fileSize,
        platform,
        downloadable: true,
        unsupportedReason: null,
        variants: [],
      },
      variants,
    );

    logAnalysis('completed', {
      sourceUrl: sanitizeUrlForLog(sourceUrl),
      mediaType: result.mediaType,
      container: result.container,
      downloadable: true,
      variantCount: result.variants.length,
      streamTypes: [...new Set(result.variants.map((v) => v.streamType))],
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      logAnalysis('failed', {
        sourceUrl: sanitizeUrlForLog(sourceUrl),
        reason: error.message,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }

    if (error instanceof UnsafeUrlError) {
      logAnalysis('failed', {
        sourceUrl: sanitizeUrlForLog(sourceUrl),
        reason: 'unsafe_url',
        durationMs: Date.now() - startedAt,
      });
      throw new AppError(error.message, 400);
    }

    if (error instanceof AnalysisNetworkError) {
      const result = mapNetworkFailure(sourceUrl);
      logAnalysis('failed', {
        sourceUrl: sanitizeUrlForLog(sourceUrl),
        reason: error.kind,
        statusCode: error.statusCode ?? null,
        durationMs: Date.now() - startedAt,
      });
      return result;
    }

    logAnalysis('failed', {
      sourceUrl: sanitizeUrlForLog(sourceUrl),
      reason: 'unexpected',
      durationMs: Date.now() - startedAt,
    });

    return emptyAnalysis(sourceUrl, {
      unsupportedReason: 'ANALYSIS_FAILED',
    });
  }
};

// Re-export pipeline helpers for targeted verification.
export {
  buildQualityLabel,
  canonicalizeVariants,
  dedupeVariants,
  sortVariants,
  normalizeUrlForDedupe,
  estimateHlsFileSizeBytes,
  contentLengthToEstimatedSize,
} from './variant-pipeline.js';
export { parseHlsManifest, parseAttributeList } from './hls-parser.js';
export { splitAndNormalizeCodecs, isAudioOnlyCodecs } from './codecs.js';
