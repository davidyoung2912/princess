import { useCallback, useEffect, useState } from 'react'
import { api } from '../runtime'
import { channel } from '../runtime/channel'
import { usePersona } from './useDemo'

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
    const load = () => {
      api.discover.favourites().then(
        (keys) => { if (current) setLoaded({ owner, keys, failed: false }) },
        () => { if (current) setLoaded({ owner, keys: [], failed: true }) },
      )
    }
    load()
    const unsubscribe = channel.subscribe((m) => { if (m.type === 'records' && m.kind === 'favourites') load() })
    return () => { current = false; unsubscribe() }
  }, [owner])

  const toggle = useCallback(async (key: string) => {
    try {
      const keys = await api.discover.toggleFavourite(key)
      setLoaded({ owner, keys, failed: false })
    } catch {
      setLoaded((l) => ({ owner, keys: l && l.owner === owner ? l.keys : [], failed: true }))
    }
  }, [owner])

  const mine = loaded?.owner === owner ? loaded : null
  const keys = mine?.keys ?? []
  return { keys, ready: mine !== null, failed: mine?.failed ?? false, has: (key) => keys.includes(key), toggle }
}
