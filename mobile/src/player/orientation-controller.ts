/**
 * Central orientation controller for player fullscreen.
 * No control should call ScreenOrientation APIs directly.
 */

export type OrientationLockKind = 'app_default' | 'landscape';

export type OrientationAdapter = {
  lockLandscape: () => Promise<void>;
  restoreDefault: () => Promise<void>;
};

let activeAdapter: OrientationAdapter | null = null;
let locked: OrientationLockKind = 'app_default';
let transitionGen = 0;

export function configureOrientationAdapter(
  adapter: OrientationAdapter | null,
): void {
  activeAdapter = adapter;
}

export function getOrientationLockKind(): OrientationLockKind {
  return locked;
}

export async function enterFullscreenOrientation(): Promise<void> {
  const gen = ++transitionGen;
  const adapter = activeAdapter;
  if (!adapter) {
    locked = 'landscape';
    return;
  }
  try {
    await adapter.lockLandscape();
    if (gen === transitionGen) {
      locked = 'landscape';
    }
  } catch {
    // Best-effort — do not throw into UI.
    if (gen === transitionGen) {
      locked = 'landscape';
    }
  }
}

export async function exitFullscreenOrientation(): Promise<void> {
  const gen = ++transitionGen;
  const adapter = activeAdapter;
  if (!adapter) {
    locked = 'app_default';
    return;
  }
  try {
    await adapter.restoreDefault();
    if (gen === transitionGen) {
      locked = 'app_default';
    }
  } catch {
    if (gen === transitionGen) {
      locked = 'app_default';
    }
  }
}

/** Alias used by lifecycle restore paths. */
export async function restoreOrientation(): Promise<void> {
  await exitFullscreenOrientation();
}

export function resetOrientationControllerForTests(): void {
  activeAdapter = null;
  locked = 'app_default';
  transitionGen = 0;
}
