export const routePaths = {
  home: '/',
  splash: '/splash',
  onboarding: '/onboarding',
  signIn: '/sign-in',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  browser: '/browser',
  downloads: '/downloads',
  downloadQueue: '/downloads/queue',
  player: '/player',
  library: '/library',
  settings: '/settings',
  downloadSettings: '/download-settings',
  profile: '/profile',
  editProfile: '/edit-profile',
  support: '/support',
  reportProblem: '/report-problem',
  about: '/about',
  privacy: '/privacy',
  terms: '/terms',
  history: '/history',
  /** Playback / watch history (distinct from browser history). */
  watchHistory: '/watch-history',
  bookmarks: '/bookmarks',
  favorites: '/favorites',
} as const;

export type RoutePath = (typeof routePaths)[keyof typeof routePaths];

/** App-stack path for a single download details screen. */
export function downloadDetailsPath(id: string): `/downloads/${string}` {
  return `/downloads/${encodeURIComponent(id)}`;
}

/** App-stack path for internal Player handoff. */
export function playerPath(id: string): `/player/${string}` {
  return `/player/${encodeURIComponent(id)}`;
}
