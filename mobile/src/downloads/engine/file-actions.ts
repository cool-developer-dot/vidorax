import { Linking, Platform, Share } from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';

import { DownloadEngineError } from './errors';
import { verifyCompletedFile } from './file-paths';
import { mimeFromFileName } from './resource-guard';

/**
 * Local completed-file actions. Uses RN Share / Linking — no extra native module.
 * Open support varies by OS/file type; Share is the reliable handoff.
 */

export function assertLocalFileAvailable(
  localUri: string | null | undefined,
  options?: { downloadId?: string; expectedBytes?: number | null },
): File {
  if (!localUri) {
    throw new DownloadEngineError(
      'PARTIAL_FILE_MISSING',
      'This file is not available on this device.',
    );
  }
  const file = new File(localUri);
  const verified = verifyCompletedFile(file, options?.expectedBytes ?? null, {
    downloadId: options?.downloadId,
  });
  if (!verified.ok) {
    throw new DownloadEngineError(
      verified.reason === 'missing' ? 'PARTIAL_FILE_MISSING' : 'FINAL_FILE_INVALID',
      verified.reason === 'missing'
        ? 'This file is missing from device storage.'
        : 'This file can’t be opened.',
    );
  }
  return file;
}

export async function shareLocalDownload(
  localUri: string,
  fileName?: string,
  options?: { downloadId?: string; expectedBytes?: number | null },
): Promise<void> {
  const file = assertLocalFileAvailable(localUri, options);
  const title = fileName?.trim() || 'Downloaded file';
  const mime = mimeFromFileName(fileName ?? file.name);
  const uri =
    Platform.OS === 'android'
      ? await FileSystem.getContentUriAsync(file.uri)
      : file.uri;

  try {
    await Share.share(
      Platform.OS === 'ios'
        ? {
            url: uri,
            title,
          }
        : {
            url: uri,
            message: title,
            title,
          },
    );
  } catch (error) {
    if (error instanceof DownloadEngineError) {
      throw error;
    }
    // User dismiss is not an error on some platforms.
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('cancel') || message.includes('dismiss')) {
      return;
    }
    throw new DownloadEngineError(
      'FILE_SYSTEM_ERROR',
      'Unable to share this file right now.',
    );
  }

  void mime;
}

export async function openLocalDownload(
  localUri: string,
  options?: { downloadId?: string; expectedBytes?: number | null; mimeType?: string | null },
): Promise<void> {
  const file = assertLocalFileAvailable(localUri, options);
  void options?.mimeType;
  const uri =
    Platform.OS === 'android'
      ? await FileSystem.getContentUriAsync(file.uri)
      : file.uri;

  try {
    const canOpen = await Linking.canOpenURL(uri);
    if (!canOpen) {
      throw new DownloadEngineError(
        'FILE_SYSTEM_ERROR',
        'No app is available to open this file. Try Share instead.',
      );
    }
    await Linking.openURL(uri);
  } catch (error) {
    if (error instanceof DownloadEngineError) {
      throw error;
    }
    throw new DownloadEngineError(
      'FILE_SYSTEM_ERROR',
      'No app is available to open this file. Try Share instead.',
    );
  }
}
