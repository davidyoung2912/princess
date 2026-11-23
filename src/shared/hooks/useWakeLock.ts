import { useEffect } from 'react'

/** Keeps the screen on while a screen that is read at a glance (the boarding pass, the meeting place) is open. Lets go when it closes; asks again when the app comes back to the front. */
export function useWakeLock(active = true): void {
  useEffect(() => {
    const wake = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock
    if (!active || !wake) return
    let lock: { release(): Promise<void> } | null = null
    let closed = false
    const take = () => {
      if (closed || document.visibilityState !== 'visible') return
      wake.request('screen').then((l) => { if (closed) void l.release(); else lock = l }).catch(() => undefined)
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => { closed = true; document.removeEventListener('visibilitychange', take); void lock?.release().catch(() => undefined) }
  }, [active])
}
