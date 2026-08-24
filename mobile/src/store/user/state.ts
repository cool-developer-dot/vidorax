import type { UserState } from './types';

export const initialUserState: UserState = {
  profile: {
    id: null,
    displayName: null,
    email: null,
  },
  preferences: {
    marketingEmails: false,
  },
  loggedIn: false,
};
