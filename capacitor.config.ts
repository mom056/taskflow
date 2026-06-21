import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.taskflow.app',
  appName: 'TaskFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'bzsmwmkgmropuadpkcku.supabase.co',
      '*.supabase.co'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      backgroundColor: '#2563eb',
      showSpinner: false,
      androidSpinnerStyle: 'large'
    },
    Keyboard: {
      resize: 'body',
      style: 'dark'
    }
  }
};

export default config;
