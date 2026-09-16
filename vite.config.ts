import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Never cache the AI API calls — they're POST requests anyway (never
        // cached by the Cache API) and reminder timing depends on fresh data.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: '課表掃描與上課提醒',
        short_name: '課表掃描',
        description: '上傳課表截圖或 PDF,辨識成結構化課表,並提供上課提醒。',
        lang: 'zh-TW',
        theme_color: '#4f46e5',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
