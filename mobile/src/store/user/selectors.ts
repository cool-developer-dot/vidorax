import type { UserStore } from './types';

export const selectUserProfile = (state: UserStore) => state.profile;
export const selectUserPreferences = (state: UserStore) => state.preferences;
export const selectLoggedIn = (state: UserStore) => state.loggedIn;
