import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/fuel-log/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '燃費ログ',
        short_name: '燃費',
        description: '満タン法で燃費を記録するPWA',
        lang: 'ja',
        display: 'standalone',
        start_url: '/fuel-log/',
        scope: '/fuel-log/',
        theme_color: '#0b1120',
        background_color: '#0b1120',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: '/fuel-log/index.html',
      },
    }),
  ],
});
