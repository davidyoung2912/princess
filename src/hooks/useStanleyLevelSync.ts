import { useEffect, useRef } from 'react'
import { levelSyncAction, normalizeMemory } from '../ai/stanleyMemory'
import { DEFAULT_SETTINGS } from '../settings/settings'
import { getSettings } from '../settings/store'
import { stanleyMemory } from '../runtime'
import { useSettings } from './useSettings'

/**
 * Keeps how much Stanley speaks up the same on every device (the server holds it). On opening, a level the server has wins over the device's; one the device has chosen and the server has not is handed up.
 * After that each change on this device is sent. Offline or signed out, the device's own choice stands and nothing is lost: the next visit reconciles it.
 */
export function useStanleyLevelSync(): void {
  const [settings, update] = useSettings()
  const known = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    stanleyMemory.get().then((r) => {
      if (!live) return
      const server = normalizeMemory(r).level
      const local = getSettings().stanleyLevel
      const action = levelSyncAction(server, local, DEFAULT_SETTINGS.stanleyLevel)
      known.current = action === 'adopt' ? server : local
      if (action === 'adopt' && server) update({ stanleyLevel: server })
      else if (action === 'push') void stanleyMemory.setLevel(local).catch(() => { known.current = undefined })
    }, () => { /* signed out or offline: the device's own choice stands */ })
    return () => { live = false }
  }, [update])
  useEffect(() => {
    if (known.current === undefined || known.current === settings.stanleyLevel) return
    const level = settings.stanleyLevel
    known.current = level
    void stanleyMemory.setLevel(level).catch(() => { known.current = undefined })
  }, [settings.stanleyLevel])
}
