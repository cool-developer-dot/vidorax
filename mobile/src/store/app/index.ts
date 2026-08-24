import { persist } from 'zustand/middleware';

import { storageKeys } from '@/constants';
import { createStore } from '@/store/shared/create-store';
import { createPersistStorage } from '@/store/shared/persist-storage';

import { createAppActions } from './actions';
import { initialAppState } from './state';
import type { AppState, AppStore } from './types';

export const useAppStore = createStore<AppStore>()(
  persist(
    (set) => ({
      ...initialAppState,
      ...createAppActions(set),
    }),
    {
      name: storageKeys.app,
      storage: createPersistStorage(),
      partialize: (state): Pick<AppState, 'firstLaunch' | 'onboardingComplete'> => ({
        firstLaunch: state.firstLaunch,
        onboardingComplete: state.onboardingComplete,
      }),
    },
  ),
);

export * from './selectors';
export type { AppActions, AppState, AppStore } from './types';
