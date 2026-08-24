import { memo, useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/base/Box';
import { EmptyState } from '@/components/common/EmptyState';
import { SafeAreaScreen } from '@/components/common/SafeAreaScreen';
import { environment } from '@/constants/environment';
import { useTheme } from '@/hooks/use-theme';
import {
  QualitySelectionSheet,
  useQualitySelection,
} from '@/screens/downloads/quality';

import {
  BrowserBookmarkControls,
  BrowserContainer,
  BrowserHeader,
  BrowserProgressBar,
  BrowserToolbar,
} from '@/browser/components';
import { BrowserEngineProvider } from '@/browser/engine';
import {
  useBrowserEngine,
  useBrowserSessionContinuity,
} from '@/browser/hooks';
import { pendingNavigationService } from '@/browser/services';
import { MediaDetectionHost, MediaDiscoveryOverlay } from '@/media-detection';

/**
 * BrowserScreen orchestrates only:
 * Initialize engine → Provide engine context → Compose chrome → Render.
 * No business logic belongs here.
 */
export const BrowserScreen = memo(function BrowserScreen() {
  const engine = useBrowserEngine();

  useFocusEffect(
    useCallback(() => {
      const pendingUrl = pendingNavigationService.take();
      if (pendingUrl) {
        engine.loadUrl(pendingUrl);
      }
    }, [engine]),
  );

  if (!environment.featureFlags.enableBrowser) {
    return (
      <SafeAreaScreen
        padded
        edges={['top', 'bottom', 'left', 'right']}
        testID="browser-screen-disabled">
        <Box flex={1} center>
          <EmptyState
            title="Browser unavailable"
            description="The in-app browser is disabled for this build."
            icon="web-off"
            testID="browser-disabled-state"
          />
        </Box>
      </SafeAreaScreen>
    );
  }

  return (
    <BrowserEngineProvider value={engine}>
      <BrowserScreenBody />
    </BrowserEngineProvider>
  );
});

/**
 * Must mount under BrowserEngineProvider so session continuity can call loadUrl.
 */
const BrowserScreenBody = memo(function BrowserScreenBody() {
  useBrowserSessionContinuity();

  const qualitySelection = useQualitySelection({
    onDownloadCreated: () => {
      AccessibilityInfo.announceForAccessibility('Download added');
    },
  });

  const openWithUrl = qualitySelection.openWithUrl;
  const handleRequestDownload = useCallback(
    async (sourceUrl: string) => {
      await openWithUrl(sourceUrl);
    },
    [openWithUrl],
  );

  return (
    <SafeAreaScreen
      padded={false}
      edges={['top', 'left', 'right']}
      testID="browser-screen">
      <MediaDetectionHost />
      <BrowserHeader trailingSlot={<BrowserBookmarkControls />} />
      <BrowserProgressBar />
      <Box flex={1} style={{ position: 'relative' }}>
        <BrowserContainer />
        <MediaDiscoveryOverlay onRequestDownload={handleRequestDownload} />
      </Box>
      <BrowserToolbarDock />
      <QualitySelectionSheet controller={qualitySelection} />
    </SafeAreaScreen>
  );
});

const BrowserToolbarDock = memo(function BrowserToolbarDock() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Box style={{ paddingBottom: insets.bottom, backgroundColor: theme.colors.background }}>
      <BrowserToolbar />
    </Box>
  );
});
