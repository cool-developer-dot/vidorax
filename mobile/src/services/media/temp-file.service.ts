import { File } from 'expo-file-system';

/**
 * Removes a derived file from the cache directory. Callers own the lifetime of
 * compressed images, since the UI may still be rendering one as a preview.
 * Failures are ignored — the OS reclaims the cache directory anyway.
 */
export function discardTempFile(uri: string): void {
  try {
    const file = new File(uri);

    if (file.exists) {
      file.delete();
    }
  } catch {
    // Intentionally ignored: cleanup must never break a user-facing flow.
  }
}

export const tempFileService = {
  discardTempFile,
} as const;
