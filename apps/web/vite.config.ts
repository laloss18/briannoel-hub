import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    // PWA: manifest + service worker precacheada. Sin runtimeCaching: la data
    // vive en Dexie/IndexedDB y se sincroniza con `stellar-drive`; el SW sólo
    // guarda el shell para que la app abra offline en campo.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        id: '/',
        name: 'Brian Noel Hub',
        short_name: 'Brian Noel',
        description: 'Hub de operaciones: ventas, clientes, zonas y catálogo.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#09090b',
        theme_color: '#09090b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    // Dev: HTTPS con cert autogenerado para que WebCrypto/PIN/PWA funcionen
    // por IP local o túneles públicos (contexto seguro). Prod construye sin server.
    host: true,
    allowedHosts: true,
  },
  build: {
    // Separa los vendors grandes en chunks propios para que el shell se
    // reutilice de caché al desplegar (el vendor casi nunca cambia).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react-dom') || id.includes('scheduler') || id.includes('/react/')) {
            return 'vendor-react';
          }
          if (id.includes('@supabase') || id.includes('supabase-js')) return 'vendor-supabase';
          if (id.includes('dexie')) return 'vendor-dexie';
          if (id.includes('zod')) return 'vendor-zod';
          return 'vendor';
        },
      },
    },
  },
});
