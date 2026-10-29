import type { Cents } from './pricing'

/**
 * What can be booked, ordered or joined on board (ENT-03, SHP-01, SHP-04, SHP-06, ACS-04): spa and fitness, shops and gift cards,
 * auctions and specials, faith and community services, and captioned or signed showings. Names, times and prices are authored concept values.
 */
export type Group = 'spa' | 'fitness' | 'shop' | 'special' | 'faith' | 'access' | 'gift'

export const GROUPS: readonly Group[] = ['spa', 'fitness', 'shop', 'special', 'faith', 'access', 'gift']

export type Support = 'captioned' | 'signed' | 'transcript'

export interface Item {
  id: string
  group: Group
  title: string
  detail: string
  /** A place on the deck plan, or "" when the item has no single place. */
  placeId: string
  /** Cruise days it runs, 1 to 8. */
  days: readonly number[]
  /** Ship-time start times to choose from; empty for items with no time (shop goods). */
  times: readonly string[]
  minutes: number
  /** Per person or per item; 0 is free; null means there is no price to pay (a service to join). */
  price: Cents | null
  /** Items in stock or places in a class; null is not limited. */
  limit: number | null
  /** The youngest guest allowed. */
  minAge: number
  /** What the guest may do: book a time, order for pickup, or just mark that they are going. */
  mode: 'book' | 'order' | 'going'
  support?: readonly Support[]
}

const SEA = [2, 6, 7]
const AT_SEA_OR_PORT = [1, 2, 3, 4, 5, 6, 7]
const PORT = [3, 4, 5]

const item = (i: Partial<Item> & Pick<Item, 'id' | 'group' | 'title' | 'detail'>): Item => ({
  placeId: '', days: AT_SEA_OR_PORT, times: [], minutes: 0, price: null, limit: null, minAge: 0, mode: 'going', ...i,
})

export const ITEMS: readonly Item[] = [
  item({ id: 'spa-swedish', group: 'spa', title: 'Swedish massage', detail: '50 minutes, light to medium pressure.', placeId: 'lotus', times: ['10:00', '13:00', '16:00'], minutes: 50, price: 13900, limit: 4, minAge: 18, mode: 'book' }),
  item({ id: 'spa-hotstone', group: 'spa', title: 'Hot stone massage', detail: '75 minutes with warmed basalt stones.', placeId: 'lotus', times: ['11:00', '15:00'], minutes: 75, price: 18900, limit: 3, minAge: 18, mode: 'book' }),
  item({ id: 'spa-facial', group: 'spa', title: 'Hydrating facial', detail: '50 minutes. Please tell us about allergies when you book.', placeId: 'lotus', times: ['09:30', '12:30', '17:00'], minutes: 50, price: 12900, limit: 4, minAge: 16, mode: 'book' }),
  item({ id: 'spa-port-special', group: 'spa', title: 'Port-day special: back and shoulders', detail: '25 minutes while most guests are ashore.', placeId: 'lotus', days: PORT, times: ['10:30', '14:00'], minutes: 25, price: 6900, limit: 6, minAge: 18, mode: 'book' }),
  item({ id: 'salon-cut', group: 'spa', title: 'Haircut and style', detail: '45 minutes.', placeId: 'lotus', times: ['09:00', '11:30', '15:00'], minutes: 45, price: 6500, limit: 3, mode: 'book' }),
  item({ id: 'salon-nails', group: 'spa', title: 'Manicure', detail: '40 minutes.', placeId: 'lotus', times: ['10:00', '14:30'], minutes: 40, price: 4500, limit: 3, mode: 'book' }),
  item({ id: 'fit-yoga', group: 'fitness', title: 'Sunrise yoga', detail: 'All levels. Mats provided.', placeId: 'fitness', days: SEA, times: ['07:00'], minutes: 45, price: 0, limit: 20, mode: 'book' }),
  item({ id: 'fit-spin', group: 'fitness', title: 'Spin class', detail: 'High energy, 45 minutes.', placeId: 'fitness', days: [2, 3, 5, 6], times: ['08:30', '17:30'], minutes: 45, price: 1200, limit: 14, minAge: 16, mode: 'book' }),
  item({ id: 'fit-trainer', group: 'fitness', title: 'Personal training session', detail: 'One to one, 45 minutes.', placeId: 'fitness', times: ['09:00', '16:00'], minutes: 45, price: 8500, limit: 2, minAge: 16, mode: 'book' }),
  item({ id: 'shop-sunscreen', group: 'shop', title: 'Reef-safe sunscreen SPF 50', detail: 'Pick up at Lido Gifts the next day.', placeId: 'shops', price: 1800, limit: 30, mode: 'order' }),
  item({ id: 'shop-hat', group: 'shop', title: 'Wide-brim sun hat', detail: 'Packs flat. Pick up at Lido Gifts.', placeId: 'shops', price: 2900, limit: 12, mode: 'order' }),
  item({ id: 'shop-tote', group: 'shop', title: 'Sun Princess tote bag', detail: 'Canvas, with an inside pocket.', placeId: 'shops', price: 2400, limit: 20, mode: 'order' }),
  item({ id: 'shop-charm', group: 'shop', title: 'Charm bracelet', detail: 'Sterling silver. Pre-order to be sure of your size.', placeId: 'shops', price: 5900, limit: 8, mode: 'order' }),
  item({ id: 'gift-25', group: 'shop', title: 'Gift card, $25', detail: 'Emailed or left in the recipient’s cabin.', placeId: 'shops', price: 2500, mode: 'order' }),
  item({ id: 'gift-50', group: 'shop', title: 'Gift card, $50', detail: 'Emailed or left in the recipient’s cabin.', placeId: 'shops', price: 5000, mode: 'order' }),
  item({ id: 'gift-100', group: 'shop', title: 'Gift card, $100', detail: 'Emailed or left in the recipient’s cabin.', placeId: 'shops', price: 10000, mode: 'order' }),
  item({ id: 'gift-flowers', group: 'gift', title: 'Fresh flowers in the cabin', detail: 'A mixed bouquet, waiting when you arrive. Tell us the occasion.', placeId: 'shops', price: 4500, limit: 20, mode: 'order' }),
  item({ id: 'gift-champagne', group: 'gift', title: 'Champagne and strawberries', detail: 'A half bottle with chocolate-dipped strawberries, delivered on the first evening.', placeId: 'shops', price: 7500, limit: 20, minAge: 21, mode: 'order' }),
  item({ id: 'gift-cake', group: 'gift', title: 'Celebration cake', detail: 'A small cake with a message, brought to your table at dinner.', placeId: 'shops', price: 3500, limit: 16, mode: 'order' }),
  item({ id: 'gift-decor', group: 'gift', title: 'Stateroom decorating', detail: 'Balloons, banner and petals for a birthday, anniversary or honeymoon.', placeId: 'shops', price: 5500, limit: 12, mode: 'order' }),
  item({ id: 'gift-kids', group: 'gift', title: 'Kids’ welcome package', detail: 'A plush toy, colouring pack and a snack box in the cabin on arrival.', placeId: 'shops', price: 3000, limit: 24, mode: 'order' }),
  item({ id: 'sp-art', group: 'special', title: 'Art auction', detail: 'Free champagne. You are not obliged to bid.', placeId: 'piazza', days: [2, 6], times: ['15:30'], minutes: 60 }),
  item({ id: 'sp-jewel', group: 'special', title: 'Jewellery event', detail: 'Port-day offers on watches and gems.', placeId: 'shops', days: PORT, times: ['11:00'], minutes: 45 }),
  item({ id: 'sp-bingo', group: 'special', title: 'Bingo book, three games', detail: 'Pre-order a book to skip the line before play.', placeId: 'live', days: SEA, times: ['14:00'], minutes: 60, price: 2500, limit: 40, minAge: 18, mode: 'order' }),
  item({ id: 'sp-daily', group: 'special', title: 'Daily special: deck-sale table', detail: 'Marked-down swimwear and souvenirs.', placeId: 'shops', days: [2, 6, 7], times: ['10:00'], minutes: 180 }),
  item({ id: 'faith-mass', group: 'faith', title: 'Catholic Mass', detail: 'All welcome.', placeId: 'piazza', days: [2, 6], times: ['08:30'], minutes: 40 }),
  item({ id: 'faith-shabbat', group: 'faith', title: 'Shabbat service', detail: 'Led by a guest volunteer. Kosher grape juice provided.', placeId: 'live', days: [5], times: ['18:00'], minutes: 40 }),
  item({ id: 'faith-interfaith', group: 'faith', title: 'Interfaith reflection', detail: 'A quiet half hour of reading and silence.', placeId: 'live', days: [2, 6], times: ['09:30'], minutes: 30 }),
  item({ id: 'faith-aa', group: 'faith', title: 'Friends of Bill W. meet-up', detail: 'A private room; ask Guest Services for the door.', placeId: 'guest-services', times: ['17:00'], minutes: 60 }),
  item({ id: 'faith-solo', group: 'faith', title: 'Solo travellers’ meet-up', detail: 'Drinks and introductions.', placeId: 'live', days: [1, 2, 6], times: ['17:30'], minutes: 45 }),
  item({ id: 'acc-show-cc', group: 'access', title: 'Welcome aboard show with captions', detail: 'Captions on the screens either side of the stage.', placeId: 'arena', days: [1], times: ['20:30'], minutes: 60, support: ['captioned'] }),
  item({ id: 'acc-show-sign', group: 'access', title: 'Stage show with sign-language interpreter', detail: 'Interpreter stands stage left. Seats reserved at the front.', placeId: 'arena', days: [2, 6], times: ['20:30'], minutes: 60, support: ['signed', 'captioned'] }),
  item({ id: 'acc-cooking', group: 'access', title: 'Cooking demo transcript', detail: 'A written transcript is handed out at the door.', placeId: 'eclipse', days: SEA, times: ['11:00'], minutes: 60, support: ['transcript'] }),
  item({ id: 'acc-comedy', group: 'access', title: 'Comedy night with captions', detail: 'Live captions on the screens.', placeId: 'live', days: [4, 7], times: ['21:30'], minutes: 45, support: ['captioned'] }),
]

export const itemById = (id: unknown): Item | undefined => ITEMS.find((i) => i.id === id)

export const itemsIn = (group: Group): Item[] => ITEMS.filter((i) => i.group === group)

/** Ship time, "HH:MM", added to minutes. */
export const endTime = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const hash = (text: string): number => {
  let h = 5381
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

/** What other guests have taken, the same every time. A class or slot is never full to start with, and the stock is never below a quarter. */
export function takenByOthers(i: Item, day: number, time = ''): number {
  if (i.limit === null) return 0
  return hash(`${i.id}|${day}|${time}`) % Math.floor((i.limit * 3) / 4 + 1)
}

export interface Selection {
  item: string
  /** 0 for items with no day (shop goods). */
  day: number
  time: string
  qty: number
}

/** The id a selection is stored under: one place per item, day and time. */
export const selectionKey = (s: Pick<Selection, 'item' | 'day' | 'time'>): string => `${s.item}@${s.day}@${s.time}`

export type SelectionProblem = 'unknown' | 'badDay' | 'badTime' | 'badQty' | 'age' | 'soldOut' | 'notBookable'

export const MAX_QTY = 6

export function selectionProblem(s: Selection, age: number, taken = 0): SelectionProblem | null {
  const i = itemById(s.item)
  if (!i) return 'unknown'
  if (age < i.minAge) return 'age'
  if (i.mode === 'order') {
    if (s.day !== 0 || s.time !== '') return 'notBookable'
  } else {
    if (!Number.isInteger(s.day) || !i.days.includes(s.day)) return 'badDay'
    if (i.times.length > 0 ? !i.times.includes(s.time) : s.time !== '') return 'badTime'
  }
  const perPerson = i.mode === 'going' ? 1 : MAX_QTY
  if (!Number.isInteger(s.qty) || s.qty < 1 || s.qty > perPerson) return 'badQty'
  if (i.limit !== null && s.qty > i.limit - taken) return 'soldOut'
  return null
}

/** The charge for a selection; 0 for anything free, or a service you only join. */
export const chargeFor = (s: Selection): Cents => (itemById(s.item)?.price ?? 0) * s.qty

/** Places left for what others have not taken, or null when there is no limit. */
export const placesLeft = (i: Item, day: number, time: string, mine: number): number | null => (i.limit === null ? null : Math.max(0, i.limit - takenByOthers(i, day, time) - mine))
