import { useSyncExternalStore } from 'react'
import { getSettings, subscribeSettings, updateSettings } from '../settings/store'
import type { Settings } from '../settings/settings'

/** The current display settings and a function to change some of them. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribeSettings, getSettings)
  return [settings, updateSettings]
}
