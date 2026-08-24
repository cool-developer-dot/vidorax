import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'production';

const DEFAULT_DEV_API_BASE_URL = 'http://localhost:3105';
const DEFAULT_PROD_API_BASE_URL = 'https://api.vidorax.com';
const ANDROID_EMULATOR_HOST_GATEWAY = '10.0.2.2';

const currentEnvironment: AppEnvironment = __DEV__ ? 'development' : 'production';

/**
 * True when running inside the Android Emulator (not a physical device).
 */
function isAndroidEmulator(): boolean {
  return Platform.OS === 'android' && Device.isDevice === false;
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

/**
 * Resolves the API host for the current runtime:
 * - Android Emulator → rewrite loopback to 10.0.2.2 (host machine gateway)
 * - iOS Simulator → keep localhost
 * - Physical device → keep EXPO_PUBLIC_API_BASE_URL (use a LAN IP)
 */
export function resolveApiHostUrl(configuredUrl: string): string {
  const trimmed = configuredUrl.trim().replace(/\/+$/, '');

  if (!trimmed) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (isAndroidEmulator() && isLoopbackHostname(url.hostname)) {
      url.hostname = ANDROID_EMULATOR_HOST_GATEWAY;
      // URL#toString may append "/" — strip trailing slash for a clean base.
      return url.toString().replace(/\/+$/, '');
    }

    return trimmed;
  } catch {
    // Fallback for non-standard values: only rewrite known loopback host strings.
    if (isAndroidEmulator()) {
      return trimmed
        .replace('://localhost', `://${ANDROID_EMULATOR_HOST_GATEWAY}`)
        .replace('://127.0.0.1', `://${ANDROID_EMULATOR_HOST_GATEWAY}`);
    }

    return trimmed;
  }
}

function readConfiguredApiBaseUrl(fallback: string): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : fallback;
}

const environmentConfig = {
  development: {
    apiBaseUrl: resolveApiHostUrl(
      readConfiguredApiBaseUrl(DEFAULT_DEV_API_BASE_URL),
    ),
    featureFlags: {
      enableBrowser: process.env.EXPO_PUBLIC_ENABLE_BROWSER !== 'false',
      enableDownloader: process.env.EXPO_PUBLIC_ENABLE_DOWNLOADER !== 'false',
      enablePlayer: process.env.EXPO_PUBLIC_ENABLE_PLAYER !== 'false',
    },
  },
  production: {
    apiBaseUrl: resolveApiHostUrl(
      readConfiguredApiBaseUrl(DEFAULT_PROD_API_BASE_URL),
    ),
    featureFlags: {
      enableBrowser: process.env.EXPO_PUBLIC_ENABLE_BROWSER === 'true',
      enableDownloader: process.env.EXPO_PUBLIC_ENABLE_DOWNLOADER !== 'false',
      enablePlayer: process.env.EXPO_PUBLIC_ENABLE_PLAYER !== 'false',
    },
  },
} as const;

const activeConfig = environmentConfig[currentEnvironment];

export const environment = {
  env: currentEnvironment,
  isDevelopment: currentEnvironment === 'development',
  isProduction: currentEnvironment === 'production',
  /** Runtime-resolved API origin (no trailing `/api` — Axios appends it). */
  apiBaseUrl: activeConfig.apiBaseUrl,
  /** Raw env value before emulator host rewriting (useful for debugging). */
  configuredApiBaseUrl: readConfiguredApiBaseUrl(
    currentEnvironment === 'development'
      ? DEFAULT_DEV_API_BASE_URL
      : DEFAULT_PROD_API_BASE_URL,
  ),
  isAndroidEmulator: isAndroidEmulator(),
  appName: Constants.expoConfig?.name ?? 'VidoraX',
  version: Constants.expoConfig?.version ?? '1.0.0',
  featureFlags: activeConfig.featureFlags,
} as const;
