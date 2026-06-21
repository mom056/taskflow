import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const isNative = process.env.VITE_PLATFORM === 'native';

export default defineConfig({
  base: isNative ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
    !isNative && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: 'TaskFlow - إدارة المهام الميدانية',
        short_name: 'TaskFlow',
        description: 'نظام متابعة المهام والزيارات الميدانية للشركات',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        dir: 'rtl',
        lang: 'ar',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192 512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/auth/, /^\/v1/],
        importScripts: ['/push-worker.js']
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
