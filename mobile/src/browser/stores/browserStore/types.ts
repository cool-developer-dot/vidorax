import type {
  BrowserErrorState,
  BrowserNavigationSnapshot,
  BrowserState,
} from '@/browser/types';

export interface BrowserActions {
  applyNavigationState: (snapshot: BrowserNavigationSnapshot) => void;
  setLoading: (isLoading: boolean) => void;
  setProgress: (progress: number) => void;
  setPageTitle: (title: string) => void;
  setCurrentUrl: (url: string) => void;
  goHome: () => void;
  setError: (error: BrowserErrorState | null) => void;
  clearError: () => void;
  markVisited: (timestamp?: number) => void;
  resetSession: () => void;
  reset: () => void;
}

export type BrowserStore = BrowserState & BrowserActions;
