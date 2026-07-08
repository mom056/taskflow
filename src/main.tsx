import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { Preferences } from '@capacitor/preferences';

import { LanguageProvider } from './contexts/LanguageContext';
import * as Sentry from '@sentry/react';

// Initialize Sentry for crash reporting & performance monitoring
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    tracePropagationTargets: ['localhost', /^https:\/\/bzsmwmkgmropuadpkcku\.supabase\.co/],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE || 'production',
  });
}

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

// Register PWA service worker using standard vanilla Web API
if (import.meta.env.VITE_PLATFORM !== 'native' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
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
