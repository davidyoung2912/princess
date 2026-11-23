import { useCallback, useState } from 'react'
import type { ExplorerVenueInfo } from '../api/explorerTypes'
import { orderVenues, venuePinKey } from '../../features/explorer/domain/venueOrder'
import { t } from '../i18n'
import { usePins } from './usePins'

export interface VenuePins {
  ready: boolean
  isPinned: (v: ExplorerVenueInfo) => boolean
  toggle: (v: ExplorerVenueInfo) => Promise<void>
  /** What a screen reader hears after a tap, and what is shown when the Explorer is full of pins. */
  message: string
  order: <V extends ExplorerVenueInfo>(venues: readonly V[]) => V[]
}

/** The guest's venue pins for one Explorer's venues, kept on the server. Pinned venues come first and a full list refuses a new pin with a message. */
export function useVenuePins(venues: readonly ExplorerVenueInfo[]): VenuePins {
  const pins = usePins()
  const [message, setMessage] = useState('')
  const inExplorer = useCallback((key: string) => venues.some((v) => venuePinKey(v.shipId, v.id) === key), [venues])
  const toggle = useCallback(async (v: ExplorerVenueInfo) => {
    const outcome = await pins.toggleVenue(v.shipId, v.id, inExplorer)
    setMessage(outcome === 'full' ? t('exp.pin.full') : outcome === 'failed' ? t('exp.pin.failed') : outcome === 'pinned' ? t('exp.pin.on', { title: v.title }) : t('exp.pin.off', { title: v.title }))
  }, [pins, inExplorer])
  return { ready: pins.ready, isPinned: (v) => pins.venueKeys.includes(venuePinKey(v.shipId, v.id)), toggle, message, order: (list) => orderVenues(list, pins.venueKeys) }
}
