import type { ReadinessFacts } from '../domain/nightBefore'

type BatteryManager = { level: number; charging: boolean; addEventListener(t: 'levelchange' | 'chargingchange', f: () => void): void }

let current: ReadinessFacts['battery'] = null
let started = false

/** Starts following the battery where the browser allows it (Chromium only); elsewhere the answer stays null and nothing changes. */
export function watchBattery(): void {
  if (started || typeof navigator === 'undefined') return
  started = true
  const get = (navigator as { getBattery?: () => Promise<BatteryManager> }).getBattery
  if (!get) return
  void get.call(navigator).then((b) => {
    const read = () => { current = { level: b.level, charging: b.charging } }
    read()
    b.addEventListener('levelchange', read)
    b.addEventListener('chargingchange', read)
  }).catch(() => { /* no battery information: refresh as usual */ })
}

export const batteryNow = (): ReadinessFacts['battery'] => current
