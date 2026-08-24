import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Longest edge of the stored avatar. 720px covers 3x retina at 240pt. */
export const AVATAR_MAX_DIMENSION = 720;

/** Upper bound for the uploaded file. Stays well under the server ceiling. */
export const AVATAR_TARGET_MAX_BYTES = 400 * 1024;

const INITIAL_QUALITY = 0.85;
const QUALITY_STEP = 0.15;
const MIN_QUALITY = 0.4;

export type CompressSource = {
  uri: string;
  width?: number;
  height?: number;
};

export type CompressedImage = {
  uri: string;
  width: number;
  height: number;
  byteSize: number;
  quality: number;
};

/**
 * Downscales the longest edge to `AVATAR_MAX_DIMENSION` (aspect preserved) and
 * then steps JPEG quality down until the encoded file fits the upload budget.
 * Uploading raw camera output (often 4–12 MB) is never acceptable on mobile
 * data, and the picker's own `quality` option gives no size guarantee.
 */
export async function compressAvatarImage(
  source: CompressSource,
): Promise<CompressedImage> {
  const context = ImageManipulator.manipulate(source.uri);
  const longestEdge = Math.max(source.width ?? 0, source.height ?? 0);
  const shouldDownscale = longestEdge === 0 || longestEdge > AVATAR_MAX_DIMENSION;

  if (shouldDownscale) {
    const isPortrait = (source.height ?? 0) > (source.width ?? 0);
    context.resize(
      isPortrait
        ? { width: null, height: AVATAR_MAX_DIMENSION }
        : { width: AVATAR_MAX_DIMENSION, height: null },
    );
  }

  const rendered = await context.renderAsync();

  let quality = INITIAL_QUALITY;
  let saved = await rendered.saveAsync({
    compress: quality,
    format: SaveFormat.JPEG,
  });
  let byteSize = new File(saved.uri).size;

  while (byteSize > AVATAR_TARGET_MAX_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    saved = await rendered.saveAsync({
      compress: quality,
      format: SaveFormat.JPEG,
    });
    byteSize = new File(saved.uri).size;
  }

  return {
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    byteSize,
    quality,
  };
}

export const imageCompressorService = {
  compressAvatarImage,
} as const;
