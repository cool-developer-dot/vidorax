import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UpdateSettingsRequest } from '@/api/types';

import { getMmkvInstance } from '@/storage/mmkv/instance';

/**
 * Lightweight pending PATCH queue for offline preference edits.
 * Scoped to the authenticated user so logout cannot leak patches across accounts.
 * Flushed on AppState active / settings refresh.
 *
 * Storage: MMKV when available; otherwise in-memory + AsyncStorage write-through
 * (Expo Go has no Nitro MMKV — queue must still survive remount/GET overlay).
 */

const PENDING_SETTINGS_KEY = 'vidorax.mmkv.preferences.pendingSync';

const PAYLOAD_KEYS = [
  'theme',
  'language',
  'notificationsEnabled',
  'wifiOnlyDownloads',
  'autoResumeDownloads',
  'downloadDirectory',
] as const;

export type PendingSettingsSync = {
  userId: string;
  payload: UpdateSettingsRequest;
  updatedAt: number;
};

/** In-memory mirror — authoritative when MMKV is unavailable. */
let memoryPending: PendingSettingsSync | null = null;
let asyncHydrateStarted = false;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStoredPayload(raw: unknown): UpdateSettingsRequest | null {
  if (!isPlainObject(raw)) {
    return null;
  }

  const payload: UpdateSettingsRequest = {};

  if (
    raw.theme === 'SYSTEM' ||
    raw.theme === 'LIGHT' ||
    raw.theme === 'DARK'
  ) {
    payload.theme = raw.theme;
  }

  if (typeof raw.language === 'string' && raw.language.trim().length > 0) {
    payload.language = raw.language.trim().toLowerCase();
  }

  if (typeof raw.notificationsEnabled === 'boolean') {
    payload.notificationsEnabled = raw.notificationsEnabled;
  }

  if (typeof raw.wifiOnlyDownloads === 'boolean') {
    payload.wifiOnlyDownloads = raw.wifiOnlyDownloads;
  }

  if (typeof raw.autoResumeDownloads === 'boolean') {
    payload.autoResumeDownloads = raw.autoResumeDownloads;
  }

  if (
    typeof raw.downloadDirectory === 'string' &&
    raw.downloadDirectory.trim().length > 0 &&
    raw.downloadDirectory.trim().length <= 255
  ) {
    payload.downloadDirectory = raw.downloadDirectory.trim();
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function parsePendingRecord(raw: string | null | undefined): PendingSettingsSync | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) {
      return null;
    }

    const userId =
      typeof parsed.userId === 'string' && parsed.userId.length > 0
        ? parsed.userId
        : null;
    const payload = sanitizeStoredPayload(parsed.payload);
    const updatedAt =
      typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now();

    if (!userId || !payload) {
      return null;
    }

    return { userId, payload, updatedAt };
  } catch {
    return null;
  }
}

function writePendingToAdapters(next: PendingSettingsSync | null): void {
  memoryPending = next;
  const mmkv = getMmkvInstance();

  if (next) {
    const serialized = JSON.stringify(next);
    mmkv?.set(PENDING_SETTINGS_KEY, serialized);
    if (!mmkv) {
      void AsyncStorage.setItem(PENDING_SETTINGS_KEY, serialized).catch(() => undefined);
    }
    return;
  }

  mmkv?.remove(PENDING_SETTINGS_KEY);
  if (!mmkv) {
    void AsyncStorage.removeItem(PENDING_SETTINGS_KEY).catch(() => undefined);
  }
}

/**
 * Best-effort hydrate of the AsyncStorage fallback (Expo Go). Safe to call often.
 */
export function ensurePendingSettingsSyncHydrated(): void {
  if (asyncHydrateStarted || getMmkvInstance()) {
    return;
  }
  asyncHydrateStarted = true;
  void AsyncStorage.getItem(PENDING_SETTINGS_KEY)
    .then((raw) => {
      if (memoryPending || getMmkvInstance()) {
        return;
      }
      memoryPending = parsePendingRecord(raw);
    })
    .catch(() => undefined);
}

export function getPendingSettingsSync(
  expectedUserId?: string | null,
): PendingSettingsSync | null {
  ensurePendingSettingsSyncHydrated();

  const mmkv = getMmkvInstance();
  const fromMmkv = mmkv
    ? parsePendingRecord(mmkv.getString(PENDING_SETTINGS_KEY))
    : null;
  const pending = fromMmkv ?? memoryPending;

  if (!pending) {
    return null;
  }

  if (expectedUserId && pending.userId !== expectedUserId) {
    // Stale queue from a previous account — discard for safety.
    clearPendingSettingsSync();
    return null;
  }

  // Keep memory mirror warm for Expo Go remounts within the same JS runtime.
  memoryPending = pending;
  return pending;
}

export function setPendingSettingsSync(
  userId: string,
  payload: UpdateSettingsRequest,
): void {
  if (!userId) {
    return;
  }

  const existing = getPendingSettingsSync(userId);
  const merged: UpdateSettingsRequest = {
    ...(existing?.payload ?? {}),
    ...payload,
  };

  writePendingToAdapters({
    userId,
    payload: merged,
    updatedAt: Date.now(),
  });
}

/**
 * Removes confirmed keys from the pending queue after a successful PATCH.
 * Clears the queue entirely when nothing remains.
 */
export function clearPendingSettingsKeys(
  userId: string,
  confirmed: UpdateSettingsRequest,
): void {
  const existing = getPendingSettingsSync(userId);
  if (!existing) {
    return;
  }

  const remaining: UpdateSettingsRequest = { ...existing.payload };

  for (const key of PAYLOAD_KEYS) {
    if (confirmed[key] !== undefined) {
      delete remaining[key];
    }
  }

  if (Object.keys(remaining).length === 0) {
    clearPendingSettingsSync();
    return;
  }

  writePendingToAdapters({
    userId,
    payload: remaining,
    updatedAt: existing.updatedAt,
  });
}

export function clearPendingSettingsSync(): void {
  writePendingToAdapters(null);
}

export function hasPendingSettingsSync(expectedUserId?: string | null): boolean {
  return getPendingSettingsSync(expectedUserId) !== null;
}
