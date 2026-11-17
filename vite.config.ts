import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: process.env.BASE_PATH || './',
  server: { watch: { ignored: ['**/work/**', '**/.npm-cache/**', '**/docs/**'] } },
  plugins: [preact(), VitePWA({
    registerType: 'prompt', injectRegister: 'script',
    manifest: { name: 'Инспектор труда: Тёмный архив', short_name: 'Инспектор труда', lang: 'ru', description: 'Учебное дело о минимальной зарплате. Демонстрационные данные.', theme_color: '#081511', background_color: '#081511', display: 'standalone', start_url: './', scope: './', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,webmanifest}'], navigateFallback: 'index.html', cleanupOutdatedCaches: true, clientsClaim: true },
  })],
});
