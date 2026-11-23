/** The one place the app reaches the browser's storage. A missing or blocked store (private mode, tests, a policy) is `null`, never an error. */
export type DeviceStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Per-device preferences and caches that outlive the visit. */
export function deviceStore(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** Storage that lasts as long as the visit. */
export function sessionStore(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch { return null }
}
