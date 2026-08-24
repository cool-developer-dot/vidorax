import type { StoreApi } from 'zustand';

import { initialUserState } from './state';
import type { UserActions, UserStore } from './types';

export function createUserActions(
  set: StoreApi<UserStore>['setState'],
): UserActions {
  return {
    updateProfile: (profile) => {
      set((state) => ({
        profile: { ...state.profile, ...profile },
        loggedIn: profile.id !== undefined ? profile.id !== null : state.loggedIn,
      }));
    },
    logout: () => {
      set({
        profile: initialUserState.profile,
        preferences: initialUserState.preferences,
        loggedIn: false,
      });
    },
    reset: () => {
      set(initialUserState);
    },
  };
}
