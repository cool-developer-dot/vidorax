import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/use-color-scheme';

export function AppStatusBar() {
  const colorScheme = useColorScheme();

  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}
