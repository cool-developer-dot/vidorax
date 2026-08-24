export type PlaybackDto = {
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  lastPlayedAt: string | null;
  completed: boolean;
  updatedAt: string;
  clientRevision: number;
};

export type UpdatePlaybackProgressInput = {
  positionSeconds: number;
  durationSeconds: number;
  /** Client clock for offline sync prep — not authoritative for DB updatedAt. */
  clientUpdatedAt?: string | null;
  /** Only when actual playback starts. */
  lastPlayedAt?: string | null;
  /** True native playToEnd — always upgrades to completed. */
  markCompleted?: boolean;
  /** Intentional Replay/Start Over near start — clears sticky completed. */
  replayReset?: boolean;
  /** Monotonic client revision for stale-write protection. */
  clientRevision?: number;
};
