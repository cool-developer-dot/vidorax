/**
 * DownloadNotificationService — single abstraction for optional local notifications.
 * Does NOT own FGS operational notification (that is native VidoraXDownloadService).
 *
 * Never starts downloads. Never schedules. Payload = { type, downloadId } only.
 */

import { mmkvKeys } from '@/storage/constants/mmkv-keys';

import {
  createNotificationDedupeStore,
  deserializeDedupeStore,
  serializeDedupeStore,
  shouldEmitTerminalNotification,
  type NotificationDedupeStore,
} from './dedupe';
import {
  capturePendingNotificationTarget,
  resolveNotificationNavigation,
} from './deep-link';
import {
  deriveEffectiveNotificationsState,
  mapExpoPermissionStatus,
  type NotificationPermissionAdapter,
} from './permission';
import type {
  DownloadNotificationPayload,
  EffectiveNotificationsState,
  NotificationPermissionStatus,
} from './types';
import { EVENT_NOTIFICATION_CHANNEL_ID } from './types';

export type LocalNotificationAdapter = {
  ensureEventChannel: () => Promise<void>;
  scheduleNotification: (input: {
    title: string;
    body: string;
    data: DownloadNotificationPayload;
    identifier: string;
  }) => Promise<void>;
  getLastNotificationResponse: () => Promise<{
    downloadId: string | null;
  } | null>;
  addResponseListener: (
    handler: (downloadId: string) => void,
  ) => () => void;
};

type ServiceOptions = {
  permissionAdapter?: NotificationPermissionAdapter;
  localAdapter?: LocalNotificationAdapter;
  getPreferenceEnabled?: () => boolean;
};


function defaultPreferenceEnabled(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { areDownloadNotificationsEnabled } = require('../settings') as {
      areDownloadNotificationsEnabled: () => boolean;
    };
    return areDownloadNotificationsEnabled();
  } catch {
    return false;
  }
}

function readMmkvString(key: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMmkvInstance } = require('@/storage/mmkv') as {
      getMmkvInstance: () => { getString: (k: string) => string | undefined } | null;
    };
    return getMmkvInstance()?.getString(key);
  } catch {
    return undefined;
  }
}

function writeMmkvString(key: string, value: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMmkvInstance } = require('@/storage/mmkv') as {
      getMmkvInstance: () => { set: (k: string, v: string) => void } | null;
    };
    getMmkvInstance()?.set(key, value);
  } catch {
    // ignore
  }
}

function isWebPlatform(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { Platform?: { OS?: string } };
    return rn.Platform?.OS === 'web';
  } catch {
    return false;
  }
}

function isAndroidPlatform(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { Platform?: { OS?: string } };
    return rn.Platform?.OS === 'android';
  } catch {
    return false;
  }
}

/**
 * Expo Go throws on Android when `expo-notifications` is imported (push removed in SDK 53).
 * Never load that package in Expo Go — use RN PermissionsAndroid + no-op local adapter.
 */
function isExpoGoRuntime(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require('expo') as { isRunningInExpoGo?: () => boolean };
    if (typeof expo.isRunningInExpoGo === 'function' && expo.isRunningInExpoGo()) {
      return true;
    }
  } catch {
    // continue
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as {
      executionEnvironment?: string;
      appOwnership?: string | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExecutionEnvironment } = require('expo-constants') as {
      ExecutionEnvironment?: { StoreClient?: string };
    };
    return (
      Constants.executionEnvironment === ExecutionEnvironment?.StoreClient ||
      Constants.appOwnership === 'expo'
    );
  } catch {
    return false;
  }
}

let singleton: DownloadNotificationService | null = null;

export class DownloadNotificationService {
  private permissionStatus: NotificationPermissionStatus = 'undetermined';
  private canAskAgain = true;
  private channelsReady = false;
  private responseAttached = false;
  private responseUnsub: (() => void) | null = null;
  private dedupe: NotificationDedupeStore;
  private readonly getPreferenceEnabled: () => boolean;
  private permissionAdapter: NotificationPermissionAdapter | null;
  private localAdapter: LocalNotificationAdapter | null;

  constructor(options: ServiceOptions = {}) {
    this.getPreferenceEnabled =
      options.getPreferenceEnabled ?? defaultPreferenceEnabled;
    this.permissionAdapter = options.permissionAdapter ?? null;
    this.localAdapter = options.localAdapter ?? null;
    this.dedupe = loadDedupeFromDisk();
  }

  async initialize(): Promise<void> {
    await this.refreshPermissionState();
    await this.ensureChannels();
    this.attachResponseListenerOnce();
    await this.captureColdStartResponse();
  }

  async refreshPermissionState(): Promise<EffectiveNotificationsState> {
    const adapter = await this.resolvePermissionAdapter();
    if (!adapter) {
      this.permissionStatus = isAndroidPlatform() ? 'undetermined' : 'unavailable';
      this.canAskAgain = false;
      return this.getEffectiveState();
    }
    try {
      const result = await adapter.getPermissionsAsync();
      this.permissionStatus = result.status;
      this.canAskAgain = result.canAskAgain;
    } catch {
      this.permissionStatus = 'unavailable';
      this.canAskAgain = false;
    }
    return this.getEffectiveState();
  }

  getEffectiveState(): EffectiveNotificationsState {
    return deriveEffectiveNotificationsState({
      preferenceEnabled: this.getPreferenceEnabled(),
      permissionStatus: this.permissionStatus,
      canAskAgain: this.canAskAgain,
    });
  }

  /**
   * User toggled preference ON — request OS permission if needed.
   * Never call from bootstrap.
   */
  async enableFromUserGesture(): Promise<EffectiveNotificationsState> {
    await this.refreshPermissionState();
    if (this.permissionStatus === 'granted') {
      return this.getEffectiveState();
    }
    if (!this.canAskAgain) {
      return this.getEffectiveState();
    }
    const adapter = await this.resolvePermissionAdapter();
    if (!adapter) {
      return this.getEffectiveState();
    }
    try {
      const result = await adapter.requestPermissionsAsync();
      this.permissionStatus = result.status;
      this.canAskAgain = result.canAskAgain;
    } catch {
      // leave prior state
    }
    return this.getEffectiveState();
  }

  async openSystemSettings(): Promise<void> {
    const adapter = await this.resolvePermissionAdapter();
    await adapter?.openSystemSettings?.();
  }

  async notifyCompleted(input: {
    downloadId: string;
    title: string;
  }): Promise<boolean> {
    return this.emitTerminal('COMPLETED', input);
  }

  async notifyFailed(input: {
    downloadId: string;
    title: string;
  }): Promise<boolean> {
    return this.emitTerminal('FAILED', input);
  }

  /** Test / injection. */
  getDedupeStore(): NotificationDedupeStore {
    return this.dedupe;
  }

  dispose(): void {
    this.responseUnsub?.();
    this.responseUnsub = null;
    this.responseAttached = false;
  }

  private async emitTerminal(
    event: 'COMPLETED' | 'FAILED',
    input: { downloadId: string; title: string },
  ): Promise<boolean> {
    await this.refreshPermissionState();
    const effective = this.getEffectiveState();
    if (!effective.effectiveEnabled) {
      return false;
    }
    if (!shouldEmitTerminalNotification(this.dedupe, input.downloadId, event)) {
      return false;
    }
    persistDedupe(this.dedupe);

    const adapter = await this.resolveLocalAdapter();
    if (!adapter) {
      return false;
    }
    await this.ensureChannels();

    const safeTitle = sanitizeBodyTitle(input.title);
    const title = event === 'COMPLETED' ? 'Download completed' : 'Download failed';
    const body =
      event === 'COMPLETED'
        ? safeTitle
        : `${safeTitle}\nTap to view details`;

    const payload: DownloadNotificationPayload = {
      type: 'DOWNLOAD_DETAILS',
      downloadId: input.downloadId,
    };

    try {
      await adapter.scheduleNotification({
        title,
        body,
        data: payload,
        identifier: `vidorax-dl-${event.toLowerCase()}-${input.downloadId}`,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async ensureChannels(): Promise<void> {
    if (this.channelsReady) {
      return;
    }
    const adapter = await this.resolveLocalAdapter();
    if (!adapter) {
      return;
    }
    try {
      await adapter.ensureEventChannel();
      this.channelsReady = true;
    } catch {
      // non-fatal
    }
  }

  private attachResponseListenerOnce(): void {
    if (this.responseAttached) {
      return;
    }
    this.responseAttached = true;
    void this.resolveLocalAdapter().then((adapter) => {
      if (!adapter) {
        return;
      }
      this.responseUnsub = adapter.addResponseListener((downloadId) => {
        void resolveNotificationNavigation(downloadId);
      });
    });
  }

  private async captureColdStartResponse(): Promise<void> {
    const adapter = await this.resolveLocalAdapter();
    if (!adapter) {
      return;
    }
    try {
      const response = await adapter.getLastNotificationResponse();
      if (response?.downloadId) {
        capturePendingNotificationTarget(response.downloadId);
      }
    } catch {
      // ignore
    }
  }

  private async resolvePermissionAdapter(): Promise<NotificationPermissionAdapter | null> {
    if (this.permissionAdapter) {
      return this.permissionAdapter;
    }
    if (isWebPlatform()) {
      return null;
    }
    try {
      if (isExpoGoRuntime()) {
        this.permissionAdapter = await createExpoGoPermissionAdapter();
      } else {
        this.permissionAdapter = await createExpoPermissionAdapter();
      }
      return this.permissionAdapter;
    } catch {
      return null;
    }
  }

  private async resolveLocalAdapter(): Promise<LocalNotificationAdapter | null> {
    if (this.localAdapter) {
      return this.localAdapter;
    }
    if (isWebPlatform()) {
      return null;
    }
    try {
      // Never import expo-notifications inside Expo Go (Android throws).
      if (isExpoGoRuntime()) {
        this.localAdapter = createExpoGoNoopLocalAdapter();
      } else {
        this.localAdapter = await createExpoLocalAdapter();
      }
      return this.localAdapter;
    } catch {
      return null;
    }
  }
}

function sanitizeBodyTitle(title: string): string {
  const trimmed = (title ?? '').trim() || 'Download';
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('://')) {
    return 'Download';
  }
  return trimmed.length > 80 ? `${trimmed.slice(0, 79)}…` : trimmed;
}

function loadDedupeFromDisk(): NotificationDedupeStore {
  try {
    const raw = readMmkvString(mmkvKeys.downloadNotificationEvents);
    return deserializeDedupeStore(raw);
  } catch {
    return createNotificationDedupeStore();
  }
}

function persistDedupe(store: NotificationDedupeStore): void {
  try {
    writeMmkvString(
      mmkvKeys.downloadNotificationEvents,
      serializeDedupeStore(store),
    );
  } catch {
    // ignore
  }
}

async function createExpoGoPermissionAdapter(): Promise<NotificationPermissionAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform, PermissionsAndroid } = require('react-native') as {
    Platform: { OS: string; Version: number | string };
    PermissionsAndroid: {
      PERMISSIONS: { POST_NOTIFICATIONS?: string };
      RESULTS: { GRANTED: string; DENIED: string; NEVER_ASK_AGAIN: string };
      check: (permission: string) => Promise<boolean>;
      request: (permission: string) => Promise<string>;
    };
  };
  const Linking = await import('expo-linking');

  const postNotifications = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;

  return {
    async getPermissionsAsync() {
      if (Platform.OS !== 'android') {
        return { status: 'unavailable' as const, canAskAgain: false };
      }
      // Pre-33: notification permission not required at runtime.
      if (typeof Platform.Version === 'number' && Platform.Version < 33) {
        return { status: 'granted' as const, canAskAgain: true };
      }
      if (!postNotifications) {
        return { status: 'granted' as const, canAskAgain: true };
      }
      try {
        const granted = await PermissionsAndroid.check(postNotifications);
        return {
          status: granted ? ('granted' as const) : ('denied' as const),
          canAskAgain: true,
        };
      } catch {
        return { status: 'unavailable' as const, canAskAgain: false };
      }
    },
    async requestPermissionsAsync() {
      if (Platform.OS !== 'android' || !postNotifications) {
        return { status: 'unavailable' as const, canAskAgain: false };
      }
      if (typeof Platform.Version === 'number' && Platform.Version < 33) {
        return { status: 'granted' as const, canAskAgain: true };
      }
      try {
        const result = await PermissionsAndroid.request(postNotifications);
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          return { status: 'granted' as const, canAskAgain: true };
        }
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          return { status: 'denied' as const, canAskAgain: false };
        }
        return { status: 'denied' as const, canAskAgain: true };
      } catch {
        return { status: 'unavailable' as const, canAskAgain: false };
      }
    },
    async openSystemSettings() {
      await Linking.openSettings();
    },
  };
}

/** Expo Go cannot load expo-notifications on Android — no optional event alerts here. */
function createExpoGoNoopLocalAdapter(): LocalNotificationAdapter {
  return {
    async ensureEventChannel() {},
    async scheduleNotification() {
      if (__DEV__) {
        console.info(
          '[downloads/notifications] Optional local notifications require a development build (not Expo Go).',
        );
      }
    },
    async getLastNotificationResponse() {
      return null;
    },
    addResponseListener() {
      return () => undefined;
    },
  };
}

async function createExpoPermissionAdapter(): Promise<NotificationPermissionAdapter> {
  // Dev/production native builds only — never call from Expo Go.
  const Notifications = await import('expo-notifications');
  const Linking = await import('expo-linking');

  return {
    async getPermissionsAsync() {
      const result = await Notifications.getPermissionsAsync();
      return {
        status: mapExpoPermissionStatus(result.status),
        canAskAgain: result.canAskAgain !== false,
      };
    },
    async requestPermissionsAsync() {
      const result = await Notifications.requestPermissionsAsync();
      return {
        status: mapExpoPermissionStatus(result.status),
        canAskAgain: result.canAskAgain !== false,
      };
    },
    async openSystemSettings() {
      await Linking.openSettings();
    },
  };
}

async function createExpoLocalAdapter(): Promise<LocalNotificationAdapter> {
  const Notifications = await import('expo-notifications');

  // Local notifications only — never register push tokens.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  return {
    async ensureEventChannel() {
      if (!isAndroidPlatform()) {
        return;
      }
      await Notifications.setNotificationChannelAsync(EVENT_NOTIFICATION_CHANNEL_ID, {
        name: 'Download updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        bypassDnd: false,
        enableVibrate: false,
        showBadge: false,
      });
    },

    async scheduleNotification({ title, body, data, identifier }) {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title,
          body,
          data,
          sound: false,
        },
        trigger: null,
      });
    },

    async getLastNotificationResponse() {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) {
        return null;
      }
      const data = response.notification.request.content.data as
        | DownloadNotificationPayload
        | undefined;
      if (data?.type === 'DOWNLOAD_DETAILS' && typeof data.downloadId === 'string') {
        return { downloadId: data.downloadId };
      }
      return { downloadId: null };
    },

    addResponseListener(handler) {
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | DownloadNotificationPayload
          | undefined;
        if (data?.type === 'DOWNLOAD_DETAILS' && typeof data.downloadId === 'string') {
          handler(data.downloadId);
        }
      });
      return () => {
        sub.remove();
      };
    },
  };
}

export function getDownloadNotificationService(): DownloadNotificationService {
  if (!singleton) {
    singleton = new DownloadNotificationService();
  }
  return singleton;
}

export function createDownloadNotificationService(
  options: ServiceOptions,
): DownloadNotificationService {
  return new DownloadNotificationService(options);
}

export function setDownloadNotificationServiceForTests(
  value: DownloadNotificationService | null,
): void {
  singleton = value;
}
