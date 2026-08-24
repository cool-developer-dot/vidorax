export interface UserProfile {
  id: string | null;
  displayName: string | null;
  email: string | null;
}

export interface UserPreferences {
  marketingEmails: boolean;
}

export interface UserState {
  profile: UserProfile;
  preferences: UserPreferences;
  loggedIn: boolean;
}

export interface UserActions {
  updateProfile: (profile: Partial<UserProfile>) => void;
  logout: () => void;
  reset: () => void;
}

export type UserStore = UserState & UserActions;
