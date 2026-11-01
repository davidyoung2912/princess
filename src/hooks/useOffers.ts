import { useCallback, useSyncExternalStore } from 'react'
import { dismissOffer, restoreOffer, type OfferId, type OfferState } from '../domain/offers'
import { getOfferState, subscribeOffers, updateOfferState } from '../offers/store'
import { usePersona } from './useDemo'

/** The signed-in person's offer choices, and functions to dismiss an offer for a trip or bring it back. */
export function useOffers(): { state: OfferState; dismiss: (trip: string, id: OfferId) => void; restore: (trip: string, id: OfferId) => void } {
  const me = usePersona()?.id ?? null
  const state = useSyncExternalStore(subscribeOffers, () => getOfferState(me), () => getOfferState(me))
  const dismiss = useCallback((trip: string, id: OfferId) => updateOfferState(me, (s) => dismissOffer(s, trip, id)), [me])
  const restore = useCallback((trip: string, id: OfferId) => updateOfferState(me, (s) => restoreOffer(s, trip, id)), [me])
  return { state, dismiss, restore }
}
