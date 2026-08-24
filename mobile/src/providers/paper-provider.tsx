import { PaperProvider, Portal } from 'react-native-paper';
import { type PropsWithChildren, useMemo } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { createPaperTheme } from '@/providers/paper-theme';

export function AppPaperProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const paperTheme = useMemo(() => createPaperTheme(mode), [mode]);

  return (
    <PaperProvider theme={paperTheme}>
      <Portal.Host>{children}</Portal.Host>
    </PaperProvider>
  );
}
