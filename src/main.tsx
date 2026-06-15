import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { Preferences } from '@capacitor/preferences';
import { registerSW } from 'virtual:pwa-register';

import { LanguageProvider } from './contexts/LanguageContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      staleTime: 1000 * 60 * 5,        // 5 minutes
    },
  },
});

// Custom async persister using Capacitor Preferences (UserDefaults on iOS / SharedPrefs on Android)
const capacitorPersister = {
  persistClient: async (client: any) => {
    try {
      await Preferences.set({
        key: 'REACT_QUERY_OFFLINE_CACHE',
        value: JSON.stringify(client),
      });
    } catch (err) {
      console.warn('[OfflinePersist] Failed to save query cache:', err);
    }
  },
  restoreClient: async () => {
    try {
      const { value } = await Preferences.get({ key: 'REACT_QUERY_OFFLINE_CACHE' });
      if (!value) return undefined;
      return JSON.parse(value);
    } catch (err) {
      console.warn('[OfflinePersist] Failed to restore query cache:', err);
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await Preferences.remove({ key: 'REACT_QUERY_OFFLINE_CACHE' });
    } catch (err) {
      console.warn('[OfflinePersist] Failed to remove query cache:', err);
    }
  },
};

persistQueryClient({
  queryClient,
  persister: capacitorPersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
});

// Register PWA service worker
if (import.meta.env.VITE_PLATFORM !== 'native') {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </StrictMode>,
);
