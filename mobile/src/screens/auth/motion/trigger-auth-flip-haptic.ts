import { Platform, Vibration } from 'react-native';

/**
 * Light settle haptic after the card flip completes.
 * Gracefully no-ops when haptics are unavailable.
 */
export async function triggerAuthFlipSettleHaptic(): Promise<void> {
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  } catch {
    // Package may be absent or unsupported on this device.
  }

  if (Platform.OS === 'android') {
    try {
      Vibration.vibrate(12);
    } catch {
      // Ignore unsupported vibration.
    }
  }
}
