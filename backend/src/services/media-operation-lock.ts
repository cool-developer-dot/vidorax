/**
 * Lightweight per-media operation lock.
 * Keeps destructive operations from racing (rename/delete).
 *
 * Note: this is in-memory only; sufficient for single-process runtimes.
 */
const mediaLocks = new Map<string, Promise<void>>();

export async function withMediaOperationLock<T>(
  mediaId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = mediaLocks.get(mediaId) ?? Promise.resolve();

  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });

  mediaLocks.set(mediaId, previous.then(() => next));

  try {
    await previous;
    return await fn();
  } finally {
    release();
    // Only clear if we still own the current lock chain.
    if (mediaLocks.get(mediaId) === next) {
      mediaLocks.delete(mediaId);
    }
  }
}

