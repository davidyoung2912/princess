import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/figtree/latin-400.css'
import '@fontsource/figtree/latin-500.css'
import '@fontsource/figtree/latin-600.css'
import '@fontsource/figtree/latin-700.css'
import '@fontsource/lora/latin-600.css'
import '@fontsource/lora/latin-700.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary'
import { startRuntime } from './runtime'
import { applySettings, watchDeviceTheme } from './settings/store'

applySettings()
watchDeviceTheme()

/** Fade out and remove the first-load splash (drawn in index.html) once the app has painted. */
function dismissBoot() {
  const boot = document.getElementById('boot')
  if (!boot) return
  requestAnimationFrame(() => requestAnimationFrame(() => {
    boot.classList.add('done')
    setTimeout(() => boot.remove(), 400)
  }))
}

// Wait briefly for the text fonts so headings do not visibly resize when they arrive.
const fontsReady = Promise.race([
  Promise.all([document.fonts.load('600 1em Lora'), document.fonts.load('400 1em Figtree'), document.fonts.load('700 1em Figtree')]),
  new Promise((done) => setTimeout(done, 1500)),
]).catch(() => {})

void Promise.all([fontsReady, startRuntime().catch(() => {})]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
  dismissBoot()
})
