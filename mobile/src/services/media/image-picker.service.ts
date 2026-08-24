import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';

export type ImageSource = 'camera' | 'library';

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  /** Bytes as reported by the OS. Not always available. */
  fileSize?: number;
  mimeType?: string;
};

export type PickImageResult =
  | { status: 'picked'; image: PickedImage }
  | { status: 'canceled' }
  | { status: 'permission-denied'; source: ImageSource; canAskAgain: boolean };

const AVATAR_PICKER_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  // Compression is handled deterministically by the compressor, so the picker
  // hands back the highest-fidelity source it can.
  quality: 1,
  exif: false,
} as const satisfies ImagePicker.ImagePickerOptions;

const toPickedImage = (asset: ImagePicker.ImagePickerAsset): PickedImage => ({
  uri: asset.uri,
  width: asset.width,
  height: asset.height,
  fileSize: asset.fileSize,
  mimeType: asset.mimeType,
});

const requestPermission = async (
  source: ImageSource,
): Promise<ImagePicker.PermissionResponse> =>
  source === 'camera'
    ? ImagePicker.requestCameraPermissionsAsync()
    : ImagePicker.requestMediaLibraryPermissionsAsync();

/**
 * Requests the relevant permission and opens the camera or the photo library.
 * Permission prompts happen before the picker so the user is never surprised
 * by a system dialog after choosing an image.
 */
export async function pickAvatarImage(
  source: ImageSource,
): Promise<PickImageResult> {
  const permission = await requestPermission(source);

  if (!permission.granted) {
    return {
      status: 'permission-denied',
      source,
      canAskAgain: permission.canAskAgain,
    };
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(AVATAR_PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(AVATAR_PICKER_OPTIONS);

  if (result.canceled) {
    return { status: 'canceled' };
  }

  const asset = result.assets.at(0);

  if (!asset) {
    return { status: 'canceled' };
  }

  return { status: 'picked', image: toPickedImage(asset) };
}

// Recovery is a once-per-runtime event, and the claim flags guard against two
// mounted editors both consuming the same recovered asset.
let pendingClaim: Promise<PickedImage | null> | null = null;
let pendingClaimed = false;

/**
 * Android can destroy the activity while the camera is open, discarding the
 * picker result. This reclaims that result on the next launch so the user does
 * not silently lose the photo they just took.
 */
export async function consumePendingAvatarImage(): Promise<PickedImage | null> {
  if (Platform.OS !== 'android' || pendingClaimed) {
    return null;
  }

  pendingClaim ??= (async () => {
    try {
      const pending = await ImagePicker.getPendingResultAsync();

      if (!pending || !('assets' in pending) || pending.canceled) {
        return null;
      }

      const asset = pending.assets?.at(0);
      return asset ? toPickedImage(asset) : null;
    } catch {
      return null;
    }
  })();

  const result = await pendingClaim;

  if (pendingClaimed) {
    return null;
  }

  pendingClaimed = true;
  return result;
}

export async function openSystemSettings(): Promise<void> {
  await Linking.openSettings();
}

export const imagePickerService = {
  pickAvatarImage,
  consumePendingAvatarImage,
  openSystemSettings,
} as const;
