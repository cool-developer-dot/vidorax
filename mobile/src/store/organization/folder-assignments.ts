import { persist } from 'zustand/middleware';

import { mediaApi } from '@/api';
import { createStore } from '@/store/shared/create-store';
import { createPersistStorage } from '@/store/shared/persist-storage';
import { storageKeys } from '@/constants';

type FolderId = string | null;

type FolderAssignmentsState = {
  /**
   * Effective (optimistic) folder assignment for offline-friendly filtering.
   * Only stores explicit assignments; fallback to server/device values when absent.
   */
  folderIdByMediaId: Record<string, FolderId>;
};

type FolderAssignmentsRuntimeState = {
  mutationSeqByMediaId: Record<string, number>;
  pendingByMediaId: Record<string, boolean>;
  inFlightDesiredByMediaId: Record<string, FolderId>;
  rollbackByMediaId: Record<
    string,
    { seq: number; previousFolderId: FolderId }
  >;
};

type FolderAssignmentsActions = {
  getEffectiveFolderId: (mediaId: string, fallbackFolderId: FolderId) => FolderId;
  isFolderMutationPending: (mediaId: string) => boolean;
  syncFromRemoteAssignments: (assignments: Record<string, FolderId>) => void;
  moveMediaToFolder: (input: {
    mediaId: string;
    desiredFolderId: FolderId;
    fallbackFolderId: FolderId;
  }) => Promise<{ folderId: FolderId; source: 'optimistic' | 'server' }>;
  reset: () => void;
};

export type MediaFolderAssignmentsStore = FolderAssignmentsState &
  FolderAssignmentsRuntimeState &
  FolderAssignmentsActions;

const initialState: FolderAssignmentsState & FolderAssignmentsRuntimeState = {
  folderIdByMediaId: {},
  mutationSeqByMediaId: {},
  pendingByMediaId: {},
  inFlightDesiredByMediaId: {},
  rollbackByMediaId: {},
};

export const useMediaFolderAssignmentsStore = createStore<MediaFolderAssignmentsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      getEffectiveFolderId: (mediaId: string, fallbackFolderId: FolderId) => {
        // When we have an explicit assignment for this mediaId (including `null`),
        // that is the authoritative value for offline UI + optimistic updates.
        if (Object.prototype.hasOwnProperty.call(get().folderIdByMediaId, mediaId)) {
          return get().folderIdByMediaId[mediaId] as FolderId;
        }
        return fallbackFolderId;
      },

      isFolderMutationPending: (mediaId: string) => Boolean(get().pendingByMediaId[mediaId]),

      syncFromRemoteAssignments: (assignments: Record<string, FolderId>) => {
        const current = get().folderIdByMediaId;
        const pending = get().pendingByMediaId;

        const next = { ...current };
        for (const [mediaId, folderId] of Object.entries(assignments)) {
          // Never overwrite a user in-flight mutation.
          if (pending[mediaId]) continue;
          next[mediaId] = folderId;
        }

        set({ folderIdByMediaId: next });
      },

      moveMediaToFolder: async ({
        mediaId,
        desiredFolderId,
        fallbackFolderId,
      }) => {
        const currentEffective = get().getEffectiveFolderId(mediaId, fallbackFolderId);

        // If nothing changes, don't spam the backend.
        if (currentEffective === desiredFolderId) {
          const pending = get().pendingByMediaId[mediaId];
          if (pending && get().inFlightDesiredByMediaId[mediaId] === desiredFolderId) {
            return { folderId: desiredFolderId, source: 'optimistic' };
          }
        }

        const prev = currentEffective;
        const nextSeq = (get().mutationSeqByMediaId[mediaId] ?? 0) + 1;

        set((s) => ({
          mutationSeqByMediaId: { ...s.mutationSeqByMediaId, [mediaId]: nextSeq },
          pendingByMediaId: { ...s.pendingByMediaId, [mediaId]: true },
          inFlightDesiredByMediaId: { ...s.inFlightDesiredByMediaId, [mediaId]: desiredFolderId },
          rollbackByMediaId: {
            ...s.rollbackByMediaId,
            [mediaId]: { seq: nextSeq, previousFolderId: prev },
          },
          // Optimistic effective state updates immediately.
          folderIdByMediaId: { ...s.folderIdByMediaId, [mediaId]: desiredFolderId },
        }));

        try {
          const response = await mediaApi.patchMediaFolderAssignment(mediaId, {
            folderId: desiredFolderId,
          });

          const latestSeq = get().mutationSeqByMediaId[mediaId];
          if (latestSeq !== nextSeq) {
            // Stale completion — ignore (latest intent already applied).
            return { folderId: desiredFolderId, source: 'optimistic' };
          }

          set((s) => ({
            pendingByMediaId: { ...s.pendingByMediaId, [mediaId]: false },
            inFlightDesiredByMediaId: { ...s.inFlightDesiredByMediaId, [mediaId]: desiredFolderId },
            rollbackByMediaId:
              s.rollbackByMediaId[mediaId]?.seq === nextSeq
                ? (() => {
                    const { [mediaId]: _, ...rest } = s.rollbackByMediaId;
                    return rest;
                  })()
                : s.rollbackByMediaId,
            // Trust server if it responded (should match desiredFolderId).
            folderIdByMediaId: { ...s.folderIdByMediaId, [mediaId]: response.folderId },
          }));

          return { folderId: response.folderId, source: 'server' };
        } catch (error) {
          const latestSeq = get().mutationSeqByMediaId[mediaId];
          if (latestSeq === nextSeq) {
            set((s) => {
              const rollback = s.rollbackByMediaId[mediaId];
              const rollbackPrev = rollback?.previousFolderId ?? prev;
              const { [mediaId]: _, ...rest } = s.rollbackByMediaId;
              return {
                pendingByMediaId: { ...s.pendingByMediaId, [mediaId]: false },
                rollbackByMediaId: rest,
                folderIdByMediaId: {
                  ...s.folderIdByMediaId,
                  [mediaId]: rollbackPrev,
                },
              };
            });
          }
          throw error;
        }
      },

      reset: () => {
        set({ ...initialState });
      },
    }),
    {
      name: storageKeys.mediaFolderAssignments,
      storage: createPersistStorage<FolderAssignmentsState>(),
      partialize: (state): FolderAssignmentsState => ({
        folderIdByMediaId: state.folderIdByMediaId,
      }),
    },
  ),
);

export const selectEffectiveFolderId = (
  mediaId: string,
  fallbackFolderId: FolderId,
) => (state: MediaFolderAssignmentsStore) =>
  state.getEffectiveFolderId(mediaId, fallbackFolderId);

