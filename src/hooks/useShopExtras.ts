import { useCallback, useSyncExternalStore } from 'react'
import { setDelivery, setGift, type Delivery, type Gift, type ShopExtras } from '../domain/shopExtras'
import { getExtras, subscribeExtras, updateExtras } from '../shop/store'
import { useOwnerId } from './useDemo'

/** The signed-in person's delivery and gift choices for shop order lines. */
export function useShopExtras(): { extras: ShopExtras; deliver: (line: string, d: Delivery) => void; gift: (line: string, g: Gift | null) => void } {
  const me = useOwnerId()
  const extras = useSyncExternalStore(subscribeExtras, () => getExtras(me), () => getExtras(me))
  const deliver = useCallback((line: string, d: Delivery) => updateExtras(me, (s) => setDelivery(s, line, d)), [me])
  const gift = useCallback((line: string, g: Gift | null) => updateExtras(me, (s) => setGift(s, line, g)), [me])
  return { extras, deliver, gift }
}
