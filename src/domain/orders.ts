import type { Contains } from './menus'
import type { FolioLine } from './folio'
import type { PersonaId } from './personas'
import type { Cents } from './pricing'
import { itinerary, shipZoneOnDate, type Sailing } from './sailings'
import { zonedToEpoch } from './timezones'

/**
 * Ordering to a stateroom or a spot on deck (DIN-04), room service and scheduled breakfast (DIN-05), and what happens
 * when something runs out (DIN-11). Prices, times and the menu are authored concept values (verify before real use).
 */
export type OrderKind = 'delivery' | 'room' | 'breakfast'
export type MenuGroup = 'mains' | 'snacks' | 'desserts' | 'drinks' | 'breakfast'

export const MENU_GROUPS: readonly MenuGroup[] = ['mains', 'snacks', 'desserts', 'drinks', 'breakfast']

export interface MenuExtra { id: string; label: string; cents: Cents }

export interface MenuItem {
  id: string
  name: string
  group: MenuGroup
  cents: Cents
  alcohol: boolean
  /** A drinks package pays for it (up to the package's cap). */
  packaged: boolean
  contains: readonly Contains[]
  /** Which menus carry it. */
  on: readonly ('delivery' | 'room')[]
  extras: readonly MenuExtra[]
  /** What to offer in its place when it runs out. */
  substitute?: string
}

const x = (id: string, label: string, cents: Cents): MenuExtra => ({ id, label, cents })
const item = (id: string, name: string, group: MenuGroup, cents: Cents, on: MenuItem['on'], contains: Contains[] = [], rest: Partial<Pick<MenuItem, 'alcohol' | 'packaged' | 'extras' | 'substitute'>> = {}): MenuItem =>
  ({ id, name, group, cents, on, contains, alcohol: false, packaged: false, extras: [], ...rest })

const BOTH = ['delivery', 'room'] as const
const DELIVERY = ['delivery'] as const
const ROOM = ['room'] as const

export const MENU: readonly MenuItem[] = [
  item('cheeseburger', 'Cheeseburger', 'mains', 950, BOTH, ['meat', 'dairy', 'gluten'], { extras: [x('bacon', 'Add bacon', 250), x('no-cheese', 'No cheese', 0), x('gf-bun', 'Gluten-free bun', 150)], substitute: 'veggie-burger' }),
  item('veggie-burger', 'Veggie burger', 'mains', 950, BOTH, ['gluten', 'dairy']),
  item('fish-tacos', 'Fish tacos', 'mains', 1100, DELIVERY, ['fish', 'gluten'], { substitute: 'veggie-wrap' }),
  item('veggie-wrap', 'Veggie wrap', 'mains', 900, DELIVERY, ['gluten']),
  item('margherita', 'Margherita pizza', 'mains', 1000, DELIVERY, ['dairy', 'gluten'], { extras: [x('extra-cheese', 'Extra cheese', 150)] }),
  item('chicken-tenders', 'Chicken tenders', 'mains', 900, BOTH, ['meat', 'gluten', 'egg']),
  item('club-sandwich', 'Club sandwich', 'mains', 900, ROOM, ['meat', 'pork', 'gluten', 'egg']),
  item('caesar', 'Caesar salad', 'mains', 850, BOTH, ['egg', 'dairy', 'fish', 'gluten'], { extras: [x('chicken', 'Add chicken', 300)] }),
  item('fries', 'Fries', 'snacks', 500, BOTH),
  item('cookies', 'Cookies (four)', 'snacks', 400, BOTH, ['gluten', 'egg', 'dairy', 'nuts']),
  item('lava-cake', 'Chocolate lava cake', 'desserts', 700, BOTH, ['dairy', 'egg', 'gluten', 'nuts'], { substitute: 'fruit-plate' }),
  item('fruit-plate', 'Seasonal fruit plate', 'desserts', 600, BOTH),
  item('soda', 'Soft drink', 'drinks', 350, BOTH, [], { packaged: true }),
  item('latte', 'Latte', 'drinks', 525, BOTH, ['dairy'], { packaged: true, extras: [x('oat', 'Oat milk', 0)] }),
  item('water', 'Bottled water', 'drinks', 350, BOTH),
  item('beer', 'Draft beer', 'drinks', 800, BOTH, ['gluten'], { alcohol: true, packaged: true }),
  item('wine', 'Glass of wine', 'drinks', 1100, BOTH, [], { alcohol: true, packaged: true }),
  item('mai-tai', 'Mai Tai', 'drinks', 1300, BOTH, [], { alcohol: true, packaged: true }),
  item('premium-cocktail', 'Premium cocktail', 'drinks', 2200, BOTH, [], { alcohol: true, packaged: true }),
  item('continental', 'Continental basket', 'breakfast', 0, ROOM, ['gluten', 'dairy']),
  item('fruit-yoghurt', 'Fruit and yoghurt', 'breakfast', 0, ROOM, ['dairy']),
  item('eggs-toast', 'Eggs and toast', 'breakfast', 0, ROOM, ['egg', 'gluten']),
  item('oatmeal', 'Oatmeal with brown sugar', 'breakfast', 0, ROOM),
  item('salmon-bagel', 'Smoked salmon bagel', 'breakfast', 600, ROOM, ['fish', 'gluten', 'dairy']),
  item('coffee-pot', 'Pot of coffee', 'breakfast', 0, ROOM),
  item('orange-juice', 'Orange juice', 'breakfast', 0, ROOM),
]

export const itemById = (id: unknown): MenuItem | undefined => MENU.find((m) => m.id === id)

export const menuFor = (kind: OrderKind): MenuItem[] => MENU.filter((m) => (kind === 'breakfast' ? m.group === 'breakfast' : m.group !== 'breakfast' && m.on.includes(kind)))

/** What the scenario takes off the menu before checkout, and what runs out while it is being made. */
export const OUT_AT_MENU: readonly string[] = ['fish-tacos']
export const OUT_WHILE_PREPARING: readonly string[] = ['lava-cake']

export type Location = { kind: 'cabin' } | { kind: 'zone'; placeId: string } | { kind: 'other'; text: string }

/** Places the crew deliver to on deck (ids from the deck plan). */
export const DELIVERY_ZONES: readonly string[] = ['lido-pool', 'promenade', 'sea-view', 'dome', 'piazza']

export function locationProblem(l: Location): 'badLocation' | null {
  if (l.kind === 'cabin') return null
  if (l.kind === 'zone') return DELIVERY_ZONES.includes(l.placeId) ? null : 'badLocation'
  return typeof l.text === 'string' && l.text.trim().length >= 3 && l.text.trim().length <= 80 ? null : 'badLocation'
}

export const DELIVERY_FEE: Cents = 200
export const TIPS: readonly Cents[] = [0, 200, 500]
export const MAX_PER_LINE = 10
export const MAX_LINES = 12
export const DRINKING_AGE = 21
/** Alcohol carries the same service charge as at a bar. */
export const SERVICE_RATE = 0.18

export interface OrderLine { itemId: string; qty: number; extras: string[]; guest: PersonaId; note?: string }

export interface GuestInfo { id: PersonaId; age: number; drinkCapUsd: number }

export interface OrderInput { kind: OrderKind; lines: OrderLine[]; location: Location; tip: Cents; deliverAt?: number }

export type OrderProblem = 'empty' | 'tooMany' | 'unknownItem' | 'wrongMenu' | 'unknownExtra' | 'badQuantity' | 'noGuest' | 'underage' | 'badLocation' | 'badTip' | 'unavailable' | 'noTime'

/** Why an order cannot be placed, or null. `outOfStock` lists items the kitchen has already run out of. */
export function orderProblem(input: OrderInput, guests: readonly GuestInfo[], outOfStock: readonly string[] = []): OrderProblem | null {
  if (input.lines.length === 0) return 'empty'
  if (input.lines.length > MAX_LINES) return 'tooMany'
  if (!TIPS.includes(input.tip)) return 'badTip'
  if (locationProblem(input.location)) return 'badLocation'
  if (input.kind === 'breakfast' && typeof input.deliverAt !== 'number') return 'noTime'
  const menu = menuFor(input.kind)
  for (const l of input.lines) {
    const m = itemById(l.itemId)
    if (!m) return 'unknownItem'
    if (!menu.includes(m)) return 'wrongMenu'
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_PER_LINE) return 'badQuantity'
    if (!Array.isArray(l.extras) || !l.extras.every((e) => m.extras.some((y) => y.id === e))) return 'unknownExtra'
    const g = guests.find((y) => y.id === l.guest)
    if (!g) return 'noGuest'
    if (m.alcohol && g.age < DRINKING_AGE) return 'underage'
    if (outOfStock.includes(m.id)) return 'unavailable'
  }
  return null
}

export type Choice = 'substitute' | 'remove'

export interface PricedLine {
  index: number
  itemId: string
  name: string
  qty: number
  guest: PersonaId
  /** The price before anything else paid. */
  gross: Cents
  /** What goes on the account. */
  charge: Cents
  coveredBy?: 'package' | 'fare'
  alcohol: boolean
  group: MenuGroup
  /** Taken off the order by the guest's choice. */
  removed: boolean
  /** Swapped for something else, by the guest's choice. */
  substitutedFor?: string
}

export interface Priced { lines: PricedLine[]; fee: Cents; service: Cents; tip: Cents; total: Cents; covered: Cents }

export interface PriceOptions {
  kind: OrderKind
  location: Location
  tip: Cents
  guests: readonly GuestInfo[]
  /** A guest in isolation for illness has meals and delivery at no charge. */
  free: boolean
  choices?: Readonly<Record<number, Choice>>
}

/** Prices an order: extras, what a drinks package covers, the bar service charge, the delivery fee and the tip. */
export function priceOrder(lines: readonly OrderLine[], o: PriceOptions): Priced {
  const out: PricedLine[] = lines.map((l, index) => {
    const original = itemById(l.itemId)!
    const choice = o.choices?.[index]
    const m = choice === 'substitute' && original.substitute ? itemById(original.substitute)! : original
    const extras = m === original ? l.extras.reduce((sum, id) => sum + (m.extras.find((e) => e.id === id)?.cents ?? 0), 0) : 0
    const unit = m.cents + extras
    const gross = unit * l.qty
    const base = { index, itemId: m.id, name: m.name, qty: l.qty, guest: l.guest, alcohol: m.alcohol, group: m.group, substitutedFor: m === original ? undefined : original.id }
    if (choice === 'remove') return { ...base, gross: 0, charge: 0, removed: true }
    if (o.free && !m.alcohol && gross > 0) return { ...base, gross, charge: 0, coveredBy: 'fare' as const, removed: false }
    const cap = (o.guests.find((g) => g.id === l.guest)?.drinkCapUsd ?? 0) * 100
    if (m.packaged && cap > 0 && gross > 0) return { ...base, gross, charge: Math.max(0, unit - cap) * l.qty, coveredBy: 'package' as const, removed: false }
    return { ...base, gross, charge: gross, removed: false }
  })
  const live = out.filter((l) => !l.removed)
  const lineCharge = out.reduce((sum, l) => sum + l.charge, 0)
  const service = Math.round(live.filter((l) => l.alcohol).reduce((sum, l) => sum + l.gross, 0) * SERVICE_RATE)
  const fee = o.kind === 'delivery' && o.location.kind !== 'cabin' && !o.free && live.length > 0 ? DELIVERY_FEE : 0
  const tip = live.length > 0 ? o.tip : 0
  const covered = out.reduce((sum, l) => sum + (l.gross - l.charge), 0)
  return { lines: out, fee, service, tip, total: lineCharge + service + fee + tip, covered }
}

/** Minutes after the start at which each stage ends. */
export const TIMELINE: Record<OrderKind, { prepare: number; deliver: number }> = {
  delivery: { prepare: 5, deliver: 30 },
  room: { prepare: 5, deliver: 35 },
  breakfast: { prepare: 5, deliver: 35 },
}
/** When the on-the-way stage begins, in minutes. */
const ON_THE_WAY = { delivery: 20, room: 25, breakfast: 25 } as const

export type Stage = 'scheduled' | 'received' | 'preparing' | 'needsChoice' | 'onTheWay' | 'delivered' | 'cancelled'

export interface ProgressInput {
  kind: OrderKind
  placedAt: number
  deliverAt?: number
  cancelledAt?: number
  /** Something ran out and the guest has not yet chosen what to do. */
  pending: boolean
  /** When the last choice was made; the clock for the order stops until then. */
  resolvedAt?: number
}

export interface Progress { stage: Stage; startAt: number; etaAt: number | null }

const MIN = 60_000

/** Where an order stands. The clock stops at the moment something runs out and starts again when the guest chooses. */
export function orderProgress(o: ProgressInput, now: number): Progress {
  const t = TIMELINE[o.kind]
  const startAt = o.kind === 'breakfast' && o.deliverAt !== undefined ? o.deliverAt - t.deliver * MIN : o.placedAt
  if (o.cancelledAt !== undefined) return { stage: 'cancelled', startAt, etaAt: null }
  if (now < startAt) return { stage: 'scheduled', startAt, etaAt: startAt + t.deliver * MIN }
  const stall = o.resolvedAt !== undefined ? Math.max(0, o.resolvedAt - (startAt + t.prepare * MIN)) : 0
  const elapsed = (now - startAt - stall) / MIN
  if (o.pending && elapsed >= t.prepare) return { stage: 'needsChoice', startAt, etaAt: null }
  const etaAt = startAt + stall + t.deliver * MIN
  const stage: Stage = elapsed < t.prepare ? 'received' : elapsed < ON_THE_WAY[o.kind] ? 'preparing' : elapsed < t.deliver ? 'onTheWay' : 'delivered'
  return { stage, startAt, etaAt }
}

/** An order can be cancelled with a full refund until the kitchen has started cooking, or when it is waiting on the guest's choice. */
export const canCancel = (stage: Stage): boolean => stage === 'scheduled' || stage === 'received' || stage === 'needsChoice'

/** The location can be corrected until the order arrives. */
export const canMove = (stage: Stage): boolean => stage !== 'delivered' && stage !== 'cancelled'

export const BREAKFAST_SLOTS: readonly string[] = ['06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30']
/** Breakfast needs this much notice. */
export const BREAKFAST_LEAD_MINUTES = 120

export interface Morning { date: string; day: number; slots: { time: string; at: number }[] }

/** The next few mornings that still have a delivery time with enough notice, in ship time. */
export function breakfastMornings(s: Sailing, now: number, count = 3): Morning[] {
  const out: Morning[] = []
  for (const d of itinerary(s)) {
    const zone = shipZoneOnDate(s, d.date)
    const slots = BREAKFAST_SLOTS.map((time) => ({ time, at: zonedToEpoch(d.date, time, zone) })).filter((x) => x.at - now >= BREAKFAST_LEAD_MINUTES * MIN)
    if (slots.length > 0) out.push({ date: d.date, day: d.day, slots })
    if (out.length === count) break
  }
  return out
}

/** The account lines for an order (DIN-11 "package entitlements applied visibly"); a cancelled order shows the charge and then the refund. */
export function orderFolioLines(id: string, priced: Priced, at: number, day: number, cancelledAt?: number, tipper = ''): FolioLine[] {
  const lines: FolioLine[] = []
  for (const l of priced.lines) {
    if (l.removed) continue
    lines.push({
      id: `order-${id}-${l.index}`, day, at, category: l.group === 'drinks' ? 'drinks' : 'dining', description: `${l.qty > 1 ? `${l.qty} × ` : ''}${l.name} (order)`, guest: l.guest, cents: l.charge,
      ...(l.coveredBy ? { value: l.gross, coveredBy: l.coveredBy } : {}),
    })
  }
  const who = lines[0]?.guest ?? tipper
  if (priced.service > 0) lines.push({ id: `order-${id}-service`, day, at, category: 'tips', description: 'Bar service charge (order)', guest: who, cents: priced.service })
  if (priced.fee > 0) lines.push({ id: `order-${id}-fee`, day, at, category: 'dining', description: 'Delivery fee (order)', guest: who, cents: priced.fee })
  if (priced.tip > 0) lines.push({ id: `order-${id}-tip`, day, at, category: 'tips', description: 'Tip for the crew (order)', guest: who, cents: priced.tip })
  if (cancelledAt !== undefined && priced.total > 0) lines.push({ id: `order-${id}-refund`, day, at: cancelledAt, category: 'credit', description: 'Refund, order cancelled', guest: who, cents: -priced.total })
  return lines
}
