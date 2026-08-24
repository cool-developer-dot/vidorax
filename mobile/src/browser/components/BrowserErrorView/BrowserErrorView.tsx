import { memo, useCallback } from 'react';

import { Box } from '@/components/base/Box';
import { Text } from '@/components/base/Text';
import { Button } from '@/components/buttons/Button';

import { useTranslation, type TranslationKey } from '@/localization';

import { useBrowserEngineContext } from '@/browser/engine';
import { selectBrowserError, useBrowserStore } from '@/browser/stores';

export type BrowserErrorViewProps = {
  testID?: string;
};

export const BrowserErrorView = memo(function BrowserErrorView({
  testID = 'browser-error-view',
}: BrowserErrorViewProps) {
  const { t } = useTranslation();
  const error = useBrowserStore(selectBrowserError);
  const { loadUrl, reload, goHome } = useBrowserEngineContext();

  const isSslError = error?.code === 'ssl_error';

  const handleRetry = useCallback(() => {
    if (error?.url) {
      loadUrl(error.url);
      return;
    }
    reload();
  }, [error?.url, loadUrl, reload]);

  const handleHome = useCallback(() => {
    goHome();
  }, [goHome]);

  if (!error) {
    return null;
  }

  return (
    <Box
      testID={testID}
      flex={1}
      center
      px={24}
      gap={20}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 4 }}
      backgroundColor="background"
      accessibilityRole="alert">
      <Box center gap={8}>
        <Text variant="title" align="center" color="error">
          {t(`browser.errors.${error.code}.title` as TranslationKey)}
        </Text>
        <Text variant="bodySmall" color="textSecondary" align="center">
          {t(`browser.errors.${error.code}.message` as TranslationKey)}
        </Text>
      </Box>

      <Box row gap={12} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {isSslError ? (
          <>
            <Button
              title={t('browser.goHome')}
              onPress={handleHome}
              variant="primary"
              testID={`${testID}-home`}
              accessibilityHint={t('browser.sslHomeHint')}
            />
            <Button
              title={t('common.retry')}
              onPress={handleRetry}
              variant="outline"
              testID={`${testID}-retry`}
              accessibilityHint={t('browser.sslRetryHint')}
            />
          </>
        ) : (
          <>
            <Button
              title={t('common.retry')}
              onPress={handleRetry}
              variant="primary"
              testID={`${testID}-retry`}
              accessibilityHint={t('browser.retryHint')}
            />
            <Button
              title={t('browser.goHome')}
              onPress={handleHome}
              variant="outline"
              testID={`${testID}-home`}
              accessibilityHint={t('browser.goHomeHint')}
            />
          </>
        )}
      </Box>
    </Box>
  );
});
