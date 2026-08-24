import { persist } from 'zustand/middleware';

import { mediaApi, type MediaFolderItem } from '@/api';
import { createStore } from '@/store/shared/create-store';
import { createPersistStorage } from '@/store/shared/persist-storage';
import { storageKeys } from '@/constants';

type FoldersState = {
  itemsById: Record<string, MediaFolderItem>;
  orderedIds: string[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
};

type FoldersActions = {
  ensureReady: () => Promise<void>;
  refetch: () => Promise<void>;
  createFolder: (name: string) => Promise<MediaFolderItem>;
  renameFolder: (id: string, name: string) => Promise<MediaFolderItem>;
  deleteFolder: (id: string) => Promise<void>;
  reset: () => void;
};

export type FoldersStore = FoldersState & FoldersActions;

const initialFoldersState: FoldersState = {
  itemsById: {},
  orderedIds: [],
  loading: false,
  error: null,
  initialized: false,
};

function indexById(items: MediaFolderItem[]): {
  itemsById: Record<string, MediaFolderItem>;
  orderedIds: string[];
} {
  const itemsById: Record<string, MediaFolderItem> = {};
  const orderedIds: string[] = [];
  for (const item of items) {
    if (itemsById[item.id]) continue;
    itemsById[item.id] = item;
    orderedIds.push(item.id);
  }
  return { itemsById, orderedIds };
}

export const useFoldersStore = createStore<FoldersStore>()(
  persist(
    (set, get) => ({
      ...initialFoldersState,

      ensureReady: async () => {
        if (get().initialized || get().loading) return;
        await get().refetch();
      },

      refetch: async () => {
        set({ loading: true, error: null });
        try {
          const response = await mediaApi.listMediaFolders();
          const items = Array.isArray(response.items) ? response.items : [];
          const { itemsById, orderedIds } = indexById(items);
          set({ itemsById, orderedIds, initialized: true, loading: false, error: null });
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load folders',
          });
        }
      },

      createFolder: async (name: string) => {
        // Pessimistic create: we only insert once the server returns a stable folder id.
        set({ loading: true, error: null });
        try {
          const folder = await mediaApi.createMediaFolder({ name });
          const current = get();
          const nextItemsById = { ...current.itemsById, [folder.id]: folder };
          const nextOrderedIds = [folder.id, ...current.orderedIds].filter(
            (id, idx, arr) => arr.indexOf(id) === idx,
          );
          set({ itemsById: nextItemsById, orderedIds: nextOrderedIds, loading: false, error: null, initialized: true });
          return folder;
        } catch (error) {
          set({ loading: false, error: error instanceof Error ? error.message : 'Failed to create folder' });
          throw error;
        }
      },

      renameFolder: async (id: string, name: string) => {
        const current = get();
        const prev = current.itemsById[id];
        if (!prev) {
          throw new Error('Folder not found');
        }

        // Optimistic rename.
        const optimistic = { ...prev, name };
        set({
          itemsById: {
            ...current.itemsById,
            [id]: optimistic,
          },
          error: null,
        });

        try {
          const updated = await mediaApi.patchMediaFolderRename(id, { name });
          set({
            itemsById: {
              ...get().itemsById,
              [id]: updated,
            },
            error: null,
          });
          return updated;
        } catch (error) {
          set({
            itemsById: {
              ...get().itemsById,
              [id]: prev,
            },
            error: error instanceof Error ? error.message : 'Failed to rename folder',
          });
          throw error;
        }
      },

      deleteFolder: async (id: string) => {
        const current = get();
        const prev = current.itemsById[id];
        if (!prev) {
          throw new Error('Folder not found');
        }

        // Optimistic delete from cache (media reassignment is handled server-side).
        set({
          itemsById: Object.fromEntries(
            Object.entries(current.itemsById).filter(([folderId]) => folderId !== id),
          ),
          orderedIds: current.orderedIds.filter((x) => x !== id),
          error: null,
        });

        try {
          await mediaApi.deleteMediaFolder(id);
        } catch (error) {
          // Rollback list on failure.
          set({
            itemsById: {
              ...get().itemsById,
              [id]: prev,
            },
            orderedIds: [id, ...get().orderedIds],
            error: error instanceof Error ? error.message : 'Failed to delete folder',
          });
          throw error;
        }
      },

      reset: () => {
        set({ ...initialFoldersState });
      },
    }),
    {
      name: storageKeys.mediaFolders,
      storage: createPersistStorage<FoldersState>(),
      partialize: (state): FoldersState => ({
        itemsById: state.itemsById,
        orderedIds: state.orderedIds,
        initialized: state.initialized,
        loading: state.loading,
        error: state.error,
      }),
    },
  ),
);

export const folderIdsSelector = (state: FoldersState) => state.orderedIds;
export const foldersByIdSelector = (state: FoldersState) => state.itemsById;
export const foldersLoadingSelector = (state: FoldersState) => state.loading;
export const foldersErrorSelector = (state: FoldersState) => state.error;

