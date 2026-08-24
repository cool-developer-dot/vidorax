import { QueryClient } from '@tanstack/react-query';

import { timeouts } from '@/constants';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: timeouts.queryStaleTime,
      gcTime: timeouts.queryGcTime,
      retry: 2,
      retryDelay: (attemptIndex) => timeouts.queryRetryDelay * attemptIndex,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});
