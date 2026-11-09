import type { DeviceSession } from './provider'

/**
 * A sign-in the guest has not seen (SEC-07, IDN-01). The server lists the devices signed in; this device remembers which it has already shown the guest.
 * Any other device that is not in that list is "new": it signed in since the guest last looked. The first look only sets the baseline, so nobody is alarmed
 * by devices they had before this was added. The list is kept on this device only and holds ids, never names or places. Framework-free.
 */
const KEY = 'princess:seen-devices'
const MAX = 40
const local = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** The ids already shown, or null when this device has never looked (so there is no baseline yet). */
export function readSeen(): string[] | null {
  try {
    const raw = local()?.getItem(KEY)
    if (raw == null) return null
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-MAX) : null
  } catch { return null }
}

export function markSeen(ids: readonly string[]): void {
  try { local()?.setItem(KEY, JSON.stringify([...new Set([...(readSeen() ?? []), ...ids])].slice(-MAX))) } catch { /* the notice may show again next visit */ }
}

/** The signed-in devices other than this one that the guest has not yet been shown. With no baseline nothing is new. */
export function newDevices(devices: readonly DeviceSession[], seen: readonly string[] | null): DeviceSession[] {
  if (seen === null) return []
  return devices.filter((d) => !d.current && !seen.includes(d.id))
}
