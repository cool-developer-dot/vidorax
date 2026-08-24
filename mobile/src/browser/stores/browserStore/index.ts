import { createStore } from '@/store/shared/create-store';

import { createBrowserActions } from './actions';
import { initialBrowserState } from './state';
import type { BrowserStore } from './types';

export const useBrowserStore = createStore<BrowserStore>((set, get) => ({
  ...initialBrowserState,
  ...createBrowserActions(set, get),
}));

export * from './selectors';
export { initialBrowserState, initialBrowserSessionState } from './state';
export type { BrowserActions, BrowserStore } from './types';
