import { useCallback, useEffect } from 'react'
import { hideKey, isTasteKey, likeKey, tasteFromKeys, tasteToKeys, type TasteProfile } from '../../features/explorer/domain/recommend'
import { EMPTY_PILOT } from '../../features/pilot/logic/store'
import { usePilot } from './usePilot'
import { usePins } from './usePins'

export interface Taste {
  ready: boolean
  profile: TasteProfile
  toggleLike: (interest: string) => Promise<boolean>
  hide: (id: string) => Promise<boolean>
  /** Brings every dismissed suggestion back. */
  restoreHidden: () => Promise<boolean>
}

let moving = false

/**
 * What the guest likes and has dismissed, kept on the server among their saved items (`taste:like.<theme>`, `taste:hide.<id>`) so it follows them to every device.
 * A profile saved on this device before that goes up once, then the device forgets it.
 */
export function useTaste(): Taste {
  const pins = usePins()
  const { state, update } = usePilot()
  const profile = tasteFromKeys(pins.keys)

  useEffect(() => {
    if (!pins.ready || pins.failed || moving) return
    const local = tasteToKeys(state.taste)
    if (local.length === 0 && state.taste.likes.length + state.taste.hidden.length === 0) return
    moving = true
    void (async () => {
      try {
        for (const key of local) if (!pins.keys.includes(key)) await pins.toggleTaste(key)
        update((s) => ({ ...s, taste: EMPTY_PILOT.taste }))
      } finally { moving = false }
    })()
  }, [pins, state.taste, update])

  const toggleLike = useCallback((interest: string) => pins.toggleTaste(likeKey(interest)), [pins])
  const hide = useCallback(async (id: string) => (pins.keys.includes(hideKey(id)) ? true : pins.toggleTaste(hideKey(id))), [pins])
  const restoreHidden = useCallback(async () => {
    let ok = true
    for (const k of pins.keys.filter((k) => isTasteKey(k) && !k.startsWith('taste:like.'))) ok = (await pins.toggleTaste(k)) && ok
    return ok
  }, [pins])
  return { ready: pins.ready, profile, toggleLike, hide, restoreHidden }
}
