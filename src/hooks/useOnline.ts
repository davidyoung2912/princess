import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void): (() => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}

/** Whether the browser thinks it has a connection (it can be wrong either way, so the label never promises delivery). */
export const useOnline = (): boolean => useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true)
