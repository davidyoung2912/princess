import { useCallback, useEffect, useState } from 'react'
import { api, loadContext } from '../../app/runtime'
import { channel } from '../../app/runtime/channel'
import { usePersona } from './useDemo'
import { deviceStore, flushFavourites, heldFavourites, holdFavourite, withHeld } from '../data/favouriteQueue'
import { worthRetrying } from './useOutbox'
const store = deviceStore

export interface Favourites {
  keys: readonly string[]
  /** True once this person's saved list has loaded (or failed); buttons wait for it so a tap cannot undo a save it has not seen. */
  ready: boolean
  /** True when the last load or change failed. */
  failed: boolean
  has: (key: string) => boolean
  toggle: (key: string) => Promise<void>
}

interface Loaded {
  /** Whose list this is, so a list for a person who has since signed out is never shown as the new person's. */
  owner: string | undefined
  keys: readonly string[]
  failed: boolean
}

/** The signed-in person's saved items, kept in step with other tabs and with the person signed in. */
export function useFavourites(): Favourites {
  const owner = usePersona()?.id
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let current = true
    const held = () => (owner ? heldFavourites(store(), owner) : [])
    const load = () => {
      api.discover.favourites().then(
        (keys) => { if (current) setLoaded({ owner, keys: withHeld(keys, held()), failed: false }) },
        () => { if (current) setLoaded({ owner, keys: withHeld([], held()), failed: true }) },
      )
    }
    // Changes made with no signal go out first when the phone is back, then the list is read again.
    const flush = () => {
      if (!owner || held().length === 0) return
      void flushFavourites(store(), owner, () => api.discover.favourites(), (key) => api.discover.toggleFavourite(key)).then(() => { if (current) load() })
    }
    load()
    flush()
    window.addEventListener('online', flush)
    const unsubscribe = channel.subscribe((m) => { if (m.type === 'records' && m.kind === 'favourites') load() })
    return () => { current = false; unsubscribe(); window.removeEventListener('online', flush) }
  }, [owner])

  const toggle = useCallback(async (key: string) => {
    try {
      const keys = await api.discover.toggleFavourite(key)
      setLoaded({ owner, keys, failed: false })
      loadContext()   // saving or removing a sailing can change the guest's stage
    } catch (e) {
      // No signal or a slow link: keep the change on this phone, show it as done, and send it when the connection returns.
      if (owner && worthRetrying(e)) {
        setLoaded((l) => {
          const base = l && l.owner === owner ? l.keys : []
          const on = !base.includes(key)
          return holdFavourite(store(), owner, key, on, Date.now()) ? { owner, keys: withHeld(base, [{ key, on }]), failed: false } : { owner, keys: base, failed: true }
        })
        return
      }
      setLoaded((l) => ({ owner, keys: l && l.owner === owner ? l.keys : [], failed: true }))
    }
  }, [owner])

  const mine = loaded?.owner === owner ? loaded : null
  const keys = mine?.keys ?? []
  return { keys, ready: mine !== null, failed: mine?.failed ?? false, has: (key) => keys.includes(key), toggle }
}
