import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/figtree/latin-400.css'
import '@fontsource/figtree/latin-500.css'
import '@fontsource/figtree/latin-600.css'
import '@fontsource/figtree/latin-700.css'
import './index.css'
import App from './App.tsx'
import { watchProblems } from './diagnostics/watch'
import { ErrorBoundary } from './ErrorBoundary'
import { startRuntime, warmServer } from './runtime'
import { loadEnglishLate } from './i18n'
import { markUpdateReady } from './runtime/update'
import { applyLanguage, applySettings, watchDeviceTheme } from './settings/store'

watchProblems()
warmServer()
applySettings()
watchDeviceTheme()

// Fonts load with font-display: swap, so the first paint never waits for them.
void Promise.all([startRuntime().catch(() => {}), applyLanguage().catch(() => {}), loadEnglishLate().catch(() => {})]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
})

// Download new versions quietly and let the guest choose when to switch (PERF-02).
if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({ onNeedRefresh: () => markUpdateReady(() => void update(true)) })
  })
}
