import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { currentEndpoint, currentSupport, setBadge, syncLimits, getWatched } from '../push/browser'
import { DISPATCH_EVERY_MS, shouldDispatch } from '../push/push'
import { startVisibleInterval } from './visibleInterval'
import { api } from '../runtime'
import { useSettings } from './useSettings'

/**
 * Keeps alerts current while the app is open (N3.3, N3.5): asks the server what to send when the app opens or comes back to the front, shows the unread count on the app icon,
 * opens the screen a tapped alert is about, and passes on this phone's limits when they change. Does nothing unless this phone has allowed alerts.
 */
export function usePushSync(): void {
  const navigate = useNavigate()
  const last = useRef<number | null>(null)
  const [settings] = useSettings()

  useEffect(() => {
    if (currentSupport() !== 'granted') return
    let alive = true
    const check = async () => {
      if (!alive || !shouldDispatch(last.current, Date.now())) return
      last.current = Date.now()
      const endpoint = await currentEndpoint()
      if (!endpoint || !alive) return
      try { setBadge((await api.push.dispatch(endpoint)).unread) } catch { /* offline: the next visit tries again */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; path?: unknown } | null
      if (d?.type === 'princess-push') { last.current = null; void check() }
      else if (d?.type === 'princess-open' && typeof d.path === 'string' && d.path.startsWith('/') && !d.path.startsWith('//')) navigate(d.path)
    }
    void check()
    document.addEventListener('visibilitychange', onVisible)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    const stopTimer = startVisibleInterval(() => void check(), DISPATCH_EVERY_MS * 5)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); navigator.serviceWorker?.removeEventListener('message', onMessage); stopTimer() }
  }, [navigate])

  useEffect(() => {
    if (currentSupport() === 'granted') void syncLimits(getWatched())
  }, [settings.nudgesPerDay, settings.calm])
}
