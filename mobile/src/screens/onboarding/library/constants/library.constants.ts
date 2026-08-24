export const LIBRARY_COPY = {
  titleLead: 'Everything',
  titleAccent: 'Organized.',
  titleTrail: 'Instantly Accessible.',
  subtitle:
    'Search, play, organize and manage every download from one beautiful offline library.',
  accessibilityLabel:
    'Everything Organized. Instantly Accessible. Your offline media library stays organized, searchable, and ready to watch.',
  searchPlaceholder: 'Search downloads...',
  searchQuery: 'Movie',
  playingLabel: 'Playing Offline',
} as const;

export const LIBRARY_COLORS = {
  background: '#090B12',
  radialGlow: 'rgba(59, 130, 246, 0.1)',
  title: '#F8FAFC',
  titleAccent: '#3B82F6',
  subtitle: 'rgba(148, 163, 184, 0.78)',
  glassBg: 'rgba(15, 18, 28, 0.92)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderActive: 'rgba(96, 165, 250, 0.34)',
  chipBg: 'rgba(15, 18, 28, 0.72)',
  chipBorder: 'rgba(255, 255, 255, 0.08)',
  chipText: 'rgba(226, 232, 240, 0.82)',
  chipIcon: 'rgba(148, 163, 184, 0.9)',
  muted: 'rgba(148, 163, 184, 0.62)',
  softWhite: 'rgba(248, 250, 252, 0.92)',
  accent: '#3B82F6',
  accentSoft: 'rgba(59, 130, 246, 0.22)',
  accentGlow: 'rgba(96, 165, 250, 0.35)',
  searchBg: 'rgba(15, 18, 28, 0.88)',
  searchBorder: 'rgba(255, 255, 255, 0.1)',
  searchPlaceholder: 'rgba(148, 163, 184, 0.55)',
  searchText: 'rgba(248, 250, 252, 0.92)',
  caret: '#3B82F6',
  waveform: 'rgba(96, 165, 250, 0.85)',
} as const;

export type LibraryCardId = 'movie' | 'travel' | 'react' | 'vacation';

export type LibraryCard = {
  id: LibraryCardId;
  title: string;
  meta: string;
  /** Matches the typed search query "Movie" */
  matchesSearch: boolean;
  scatter: { x: number; y: number };
  grid: { x: number; y: number };
  dash: { x: number; y: number };
};

export const LIBRARY_CARDS: readonly LibraryCard[] = [
  {
    id: 'movie',
    title: 'Movie Trailer',
    meta: 'Completed',
    matchesSearch: true,
    scatter: { x: -78, y: -72 },
    grid: { x: -82, y: -52 },
    dash: { x: -72, y: -36 },
  },
  {
    id: 'travel',
    title: 'Travel Vlog',
    meta: '1080P',
    matchesSearch: false,
    scatter: { x: 86, y: -38 },
    grid: { x: 82, y: -52 },
    dash: { x: 72, y: -36 },
  },
  {
    id: 'react',
    title: 'React Course',
    meta: 'Saved',
    matchesSearch: false,
    scatter: { x: -96, y: 58 },
    grid: { x: -82, y: 52 },
    dash: { x: -72, y: 40 },
  },
  {
    id: 'vacation',
    title: 'Vacation Reel',
    meta: 'Offline',
    matchesSearch: false,
    scatter: { x: 72, y: 78 },
    grid: { x: 82, y: 52 },
    dash: { x: 72, y: 40 },
  },
] as const;

export type LibraryFeatureId =
  | 'favorites'
  | 'history'
  | 'search'
  | 'player'
  | 'library'
  | 'settings';

export type LibraryFeature = {
  id: LibraryFeatureId;
  label: string;
  scatter: { x: number; y: number };
  dash: { x: number; y: number };
};

export const LIBRARY_FEATURES: readonly LibraryFeature[] = [
  {
    id: 'favorites',
    label: 'Favorites',
    scatter: { x: -118, y: -118 },
    dash: { x: -108, y: -88 },
  },
  {
    id: 'history',
    label: 'History',
    scatter: { x: 20, y: -128 },
    dash: { x: 0, y: -88 },
  },
  {
    id: 'search',
    label: 'Smart Search',
    scatter: { x: 120, y: -108 },
    dash: { x: 108, y: -88 },
  },
  {
    id: 'player',
    label: 'Offline Player',
    scatter: { x: -128, y: 118 },
    dash: { x: -108, y: 92 },
  },
  {
    id: 'library',
    label: 'Organized Library',
    scatter: { x: 8, y: 132 },
    dash: { x: 0, y: 92 },
  },
  {
    id: 'settings',
    label: 'Settings',
    scatter: { x: 124, y: 112 },
    dash: { x: 108, y: 92 },
  },
] as const;

export const LIBRARY_LAYOUT = {
  cardWidth: 148,
  cardHeight: 72,
  chipHeight: 40,
  glowSize: 300,
  canvasMax: 360,
  maxFontMultiplier: 1.25,
  searchMaxWidth: 280,
} as const;
