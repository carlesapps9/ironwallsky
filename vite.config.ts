import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// On GitHub Pages the app lives at /<repo>/ — set VITE_BASE_PATH=/repo-name/ in CI.
// Defaults to '/' for local dev and Capacitor builds.
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  root: '.',
  base,
  publicDir: 'public',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,png,mp3,ogg}'],
      },
      manifest: {
        name: 'Iron Wall Sky',
        short_name: 'IronWallSky',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@adapters': resolve(__dirname, 'src/adapters'),
    },
  },
  optimizeDeps: {
    include: ['phaser'],
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
