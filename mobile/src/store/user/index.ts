import { createStore } from '@/store/shared/create-store';

import { createUserActions } from './actions';
import { initialUserState } from './state';
import type { UserStore } from './types';

export const useUserStore = createStore<UserStore>((set) => ({
  ...initialUserState,
  ...createUserActions(set),
}));

export * from './selectors';
export type { UserActions, UserPreferences, UserProfile, UserState, UserStore } from './types';
