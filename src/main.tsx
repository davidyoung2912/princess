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
import { startRuntime } from './runtime'
import { markUpdateReady } from './runtime/update'
import { applyLanguage, applySettings, watchDeviceTheme } from './settings/store'

watchProblems()
applySettings()
watchDeviceTheme()

// Wait briefly for the text fonts so headings do not visibly resize when they arrive.
const fontsReady = Promise.race([
  Promise.all([document.fonts.load('400 1em Figtree'), document.fonts.load('700 1em Figtree')]),
  new Promise((done) => setTimeout(done, 1500)),
]).catch(() => {})

void Promise.all([fontsReady, startRuntime().catch(() => {}), applyLanguage().catch(() => {})]).then(() => {
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
