import { toggleTasteKey } from '../domain/explorer/recommend'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { pinsToUpload, reorderScreenKeys, screenIdsOf, screenPinKey, toggleScreenKey, toggleVenueKey, venueKeysOf, type VenuePinOutcome } from '../domain/pins'
import { api } from '../runtime'
import { channel } from '../runtime/channel'
import { usePersona } from './useDemo'
import { useSettings } from './useSettings'

/**
 * The guest's pins, kept on the server with their other saved items so they follow the guest to every device: screens (`screen:<id>`, at most five, the oldest making room)
 * and venues (`venue:<ship>.<venue>`, at most ten in an Explorer). One store is shared by every screen that shows a pin, so a tap shows everywhere at once.
 */
interface Snapshot {
  /** Whose list this is, so a list for a person who has since signed out is never shown as the new person's. */
  owner: string | undefined
  keys: readonly string[]
  ready: boolean
  failed: boolean
}

let snap: Snapshot = { owner: undefined, keys: [], ready: false, failed: false }
const listeners = new Set<() => void>()
const emit = () => { for (const l of listeners) l() }
const set = (next: Snapshot) => { snap = next; emit() }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const get = () => snap

let loading: { owner: string | undefined; run: Promise<void> } | null = null

function load(owner: string | undefined): Promise<void> {
  const running = loading
  if (running && running.owner === owner) return running.run
  const run = api.discover.favourites().then(
    (keys) => { if (loading?.owner === owner) set({ owner, keys, ready: true, failed: false }) },
    () => { if (loading?.owner === owner) set({ owner, keys: snap.owner === owner ? snap.keys : [], ready: true, failed: true }) },
  ).finally(() => { if (loading?.owner === owner) loading = null })
  loading = { owner, run }
  return run
}

/** Forgets what is held (tests, and a sign-out). */
export function resetPins(): void { loading = null; snap = { owner: undefined, keys: [], ready: false, failed: false }; emit() }

let uploading = false

export interface Pins {
  /** True once this person's list has loaded (or failed); a tap waits for it so it cannot undo a pin it has not seen. */
  ready: boolean
  failed: boolean
  /** Pinned screen ids, in the order the guest arranged them. */
  screens: readonly string[]
  /** Pinned venue keys (`venue:<ship>.<venue>`). */
  venueKeys: readonly string[]
  isScreenPinned: (id: string) => boolean
  toggleScreen: (id: string) => Promise<void>
  /** Puts the pinned screens in this order. */
  reorderScreens: (ids: readonly string[]) => Promise<void>
  /** Every saved key, for the other kinds kept among them (the guest's taste for suggestions). */
  keys: readonly string[]
  /** Turns a taste key on or off; false when it could not be saved. */
  toggleTaste: (key: string) => Promise<boolean>
  toggleVenue: (shipId: string, venueId: string, inExplorer: (key: string) => boolean) => Promise<VenuePinOutcome | 'failed'>
}

export function usePins(): Pins {
  const owner = usePersona()?.id
  const s = useSyncExternalStore(subscribe, get, get)
  const [{ pins: legacy }, update] = useSettings()
  const mine = s.owner === owner && s.ready ? s : null
  const keys = mine?.keys ?? []

  useEffect(() => {
    void load(owner)
    return channel.subscribe((m) => { if (m.type === 'records' && m.kind === 'favourites') { loading = null; void load(owner) } })
  }, [owner])

  // Pins saved on this device before they moved to the server go up once, in their old order, then the device forgets them.
  useEffect(() => {
    if (!mine || mine.failed || legacy.length === 0 || uploading) return
    uploading = true
    void (async () => {
      try {
        let list = [...mine.keys]
        for (const id of pinsToUpload(legacy, list)) list = await api.discover.toggleFavourite(screenPinKey(id))
        list = await api.discover.reorderFavourites(legacy.map(screenPinKey))
        set({ owner, keys: list, ready: true, failed: false })
        update({ pins: [] })
      } catch { /* the device keeps its pins and tries again next time */ } finally { uploading = false }
    })()
  }, [mine, legacy, owner, update])

  const apply = useCallback(async (next: readonly string[], send: () => Promise<readonly string[]>): Promise<boolean> => {
    const before = snap
    set({ ...snap, owner, keys: next })
    try {
      const keys = await send()
      set({ owner, keys, ready: true, failed: false })
      channel.post({ type: 'records', kind: 'favourites', owner: owner ?? '' })
      return true
    } catch {
      set(before)
      return false
    }
  }, [owner])

  const toggleScreen = useCallback(async (id: string) => {
    if (!mine) return
    await apply(toggleScreenKey(snap.keys, id), () => api.discover.toggleFavourite(screenPinKey(id)))
  }, [mine, apply])

  const reorderScreens = useCallback(async (ids: readonly string[]) => {
    if (!mine) return
    await apply(reorderScreenKeys(snap.keys, ids), () => api.discover.reorderFavourites(ids.map(screenPinKey)))
  }, [mine, apply])

  const toggleVenue = useCallback(async (shipId: string, venueId: string, inExplorer: (key: string) => boolean): Promise<VenuePinOutcome | 'failed'> => {
    if (!mine) return 'failed'
    const r = toggleVenueKey(snap.keys, shipId, venueId, inExplorer)
    if (r.outcome === 'full') return 'full'
    const ok = await apply(r.keys, () => api.discover.toggleFavourite(`venue:${shipId}.${venueId}`))
    return ok ? r.outcome : 'failed'
  }, [mine, apply])

  const toggleTaste = useCallback(async (key: string): Promise<boolean> => {
    if (!mine) return false
    return apply(toggleTasteKey(snap.keys, key), () => api.discover.toggleFavourite(key))
  }, [mine, apply])

  const screens = screenIdsOf(keys)
  return { keys, toggleTaste, ready: !!mine, failed: mine?.failed ?? false, screens, venueKeys: venueKeysOf(keys), isScreenPinned: (id) => screens.includes(id), toggleScreen, reorderScreens, toggleVenue }
}
