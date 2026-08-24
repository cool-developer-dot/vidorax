import { memo } from 'react';

import { useMediaDetectionBrowserSync } from '../hooks';

/**
 * Invisible host that keeps the Media Detection Engine synchronized
 * with browser navigation. Renders nothing — no download UI.
 */
export const MediaDetectionHost = memo(function MediaDetectionHost() {
  useMediaDetectionBrowserSync();
  return null;
});
