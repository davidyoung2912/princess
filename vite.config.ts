import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig, type Plugin } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Production pages may only load from their own origin, plus Princess image hosts for guest imagery. The mock API runs
 * in-process; the only network call is to the app's own API (`connect-src`); the concierge's model is called by the server. Build-only: the dev
 * server needs inline scripts for hot reload. React sets styles through the DOM, hence 'unsafe-inline' for styles alone.
 */
const cspFor = (apiUrl: string): string => [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.princess.com",
  `connect-src 'self'${apiOrigin(apiUrl)}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

/** The API's origin for `connect-src` when `VITE_API_URL` is an absolute address (a relative one such as `/api/v1` is already 'self'). */
function apiOrigin(apiUrl: string): string {
  try { return /^https?:\/\//i.test(apiUrl) ? ` ${new URL(apiUrl).origin}` : '' } catch { return '' }
}

const contentSecurityPolicy = (apiUrl: string): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: cspFor(apiUrl) }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
  ],
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  server: { proxy: { '/api': { target: loadEnv(mode, process.cwd(), 'VITE_').VITE_API_PROXY || 'http://localhost:5182', changeOrigin: true } } },
  build: {
    rolldownOptions: {
      // React and the router get their own long-lived chunk, so a release that changes only app code leaves them cached.
      output: { codeSplitting: { groups: [{ name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 10 }] } },
    },
  },
  plugins: [
    react(),
    contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL?.trim() ?? ''),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: { importScripts: ['push-sw.js'], globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,webmanifest}'], maximumFileSizeToCacheInBytes: 700 * 1024, navigateFallback: 'index.html', navigateFallbackDenylist: [/^\/\.well-known\//] },
      manifest: {
        name: 'Princess Voyages',
        short_name: 'Princess',
        description: 'A guest app for planning and managing your cruise.',
        display: 'standalone',
        background_color: '#003595',
        theme_color: '#003595',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['src/testing/setup.ts'] },
}))
