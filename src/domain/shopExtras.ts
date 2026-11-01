import { itemById } from './catalogue'

/**
 * Cabin delivery of purchases (SHP-05) and gifting (POS-13). These choices stay on this device, one record per signed-in person, because the
 * server's order record has no place for them yet; the shop reads them when it prepares the order.
 */
export type Delivery = 'pickup' | 'cabin'

export const GIFT_CARD_IDS: readonly string[] = ['gift-25', 'gift-50', 'gift-100']
export const isGiftCard = (itemId: string): boolean => GIFT_CARD_IDS.includes(itemId)

/** Goods and cabin gifts can be brought to the cabin. A gift card is emailed or left for the recipient, never the buyer's cabin. */
export function canDeliver(itemId: string): boolean {
  const i = itemById(itemId)
  return !!i && i.mode === 'order' && !isGiftCard(itemId) && (i.group === 'shop' || i.group === 'gift') && i.placeId === 'shops'
}

/** Only gift cards can be given to someone else. */
export const canGift = (itemId: string): boolean => isGiftCard(itemId)

export const GIFT_NAME_MAX = 40
export const GIFT_MESSAGE_MAX = 140

export type GiftHow = 'email' | 'cabin'
export interface Gift { to: string; how: GiftHow; where: string; message: string }

export type GiftProblem = 'noName' | 'badName' | 'badEmail' | 'badCabin' | 'longMessage'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Why a gift cannot be sent, or null. A cabin must be four or five digits. */
export function giftProblem(g: Gift): GiftProblem | null {
  const name = g.to.trim()
  if (name.length === 0) return 'noName'
  if (name.length < 2 || name.length > GIFT_NAME_MAX) return 'badName'
  if (g.how === 'email' && !EMAIL.test(g.where.trim())) return 'badEmail'
  if (g.how === 'cabin' && !/^\d{4,5}$/.test(g.where.trim())) return 'badCabin'
  if (g.message.length > GIFT_MESSAGE_MAX) return 'longMessage'
  return null
}

/** What is saved for a person: a delivery and a gift per order line, keyed by the line's id. */
export interface ShopExtras { delivery: Record<string, Delivery>; gifts: Record<string, Gift> }
export const EMPTY_EXTRAS: ShopExtras = { delivery: {}, gifts: {} }

export function normalizeExtras(raw: unknown): ShopExtras {
  if (!raw || typeof raw !== 'object') return EMPTY_EXTRAS
  const r = raw as { delivery?: unknown; gifts?: unknown }
  const delivery: Record<string, Delivery> = {}
  const gifts: Record<string, Gift> = {}
  if (r.delivery && typeof r.delivery === 'object') {
    for (const [k, v] of Object.entries(r.delivery)) if (v === 'cabin') delivery[k] = 'cabin'
  }
  if (r.gifts && typeof r.gifts === 'object') {
    for (const [k, v] of Object.entries(r.gifts)) {
      const g = v as Partial<Gift> | null
      if (g && typeof g.to === 'string' && (g.how === 'email' || g.how === 'cabin') && typeof g.where === 'string' && typeof g.message === 'string') {
        const gift: Gift = { to: g.to, how: g.how, where: g.where, message: g.message }
        if (giftProblem(gift) === null) gifts[k] = gift
      }
    }
  }
  return { delivery, gifts }
}

export const deliveryOf = (e: ShopExtras, lineId: string): Delivery => e.delivery[lineId] ?? 'pickup'

export function setDelivery(e: ShopExtras, lineId: string, d: Delivery): ShopExtras {
  const delivery = { ...e.delivery }
  if (d === 'cabin') delivery[lineId] = 'cabin'
  else delete delivery[lineId]
  return { ...e, delivery }
}

export function setGift(e: ShopExtras, lineId: string, g: Gift | null): ShopExtras {
  const gifts = { ...e.gifts }
  if (g) gifts[lineId] = g
  else delete gifts[lineId]
  return { ...e, gifts }
}

/** Forgets choices for lines that are no longer in the order. */
export function pruneExtras(e: ShopExtras, lineIds: readonly string[]): ShopExtras {
  const keep = new Set(lineIds)
  const pick = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => keep.has(k)))
  return { delivery: pick(e.delivery), gifts: pick(e.gifts) }
}

/** When goods ordered at `at` (ship hour of the day, 0 to 23) reach the cabin: the same evening if ordered before 16:00, otherwise next morning. */
export function deliveryWindow(orderHour: number): 'today' | 'tomorrow' {
  return orderHour < 16 ? 'today' : 'tomorrow'
}
