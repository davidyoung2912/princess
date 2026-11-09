import type { StringKey } from '../i18n'
import { formatMoney, type Cents } from './money'
import type { PaymentState } from './trip'
import { timeIn } from './timezones'
import { clock12 } from './planCard'
import { STEPS, firstIncomplete, type Draft, type StepContext } from './booking'

/** How a live line reads: plain information, good news, something to look at, or something that needs the guest now. Shown with an icon and words, never colour alone. */
export type Tone = 'neutral' | 'ok' | 'warn' | 'urgent'

/** The short line shown on a tile ("14 of 40 packed") and how it should be dressed. */
export interface TileLine { text: string; tone: Tone }

/** Words for a line: the text for a `tile.*` key with `{name}` values filled in. */
export type TileKey = Extract<StringKey, `tile.${string}`>
export type Say = (key: TileKey, vars?: Record<string, string | number>) => string

/** What the tiles can be worded from. A fact is null (or left out) while it is unknown, and its tile then says nothing. */
export interface TileFacts {
  checklist?: { done: number; total: number } | null
  packing?: { ticked: number; total: number } | null
  /** Dinners already reserved; null while unknown. */
  dinners?: number | null
  /** Documents for the current booking; null for an agent booking or while unknown. */
  documents?: { missing: number; passportProblems: number } | null
  /** Time ("HH:MM") of tonight's dinner, if one is booked; null otherwise. */
  tonight?: string | null
  /** Places to eat and drink open right now; null while unknown. */
  venuesOpen?: number | null
  /** The balance on the guest's confirmed booking and how many days remain to pay it (negative once past). */
  payment?: { state: PaymentState; balance: Cents; daysToFinal: number } | null
  /** Online check-in for the confirmed booking, and the whole days until it opens (0 once open). */
  checkin?: { state: 'notOpen' | 'open' | 'closed' | 'done'; opensInDays: number } | null
  /** Whole days to departure; null while unknown. */
  daysToDeparture?: number | null
  excursions?: { booked: number; inCart: number; creditLeft: Cents } | null
  dining?: { seating: string | null; reservations: number; mealsLeft: number } | null
  packages?: { bought: number } | null
  /** Assistance requests not yet confirmed, and the days to the nearest cut-off still ahead for a kind not yet asked for (null when none). */
  assistance?: { waiting: number; cutoffDays: number | null } | null
  /** The muster drill: done, or still to do with its ship time ("4:00 PM") and whether it is within the hour. */
  muster?: { done: boolean; required: boolean; time: string; soon: boolean } | null
  /** All-aboard today: the ship time and the whole minutes left; null when the ship is not in port or the time has passed. */
  allAboard?: { time: string; minutesLeft: number } | null
  /** The account so far: balance, charges still to post, lines and the day it runs through. */
  bill?: { balance: Cents; pending: Cents; lines: number; throughDay: number } | null
  orders?: { active: number; needsChoice: number; etaMinutes: number | null } | null
  laundry?: { inProgress: number; freeBagLeft: boolean } | null
  wifi?: { devices: number; expired: number; includedLeft: number } | null
  /** Children by how they were last seen: first names of those not seen for a while and those outside their zones, and how many are in a club. */
  family?: { overdue: readonly string[]; outOfZone: readonly string[]; inClub: number } | null
  clubs?: { registered: number; total: number } | null
  /** Alerts sent to the guest and not yet read. */
  unread?: number | null
  /** Cases not yet resolved, and how many of those are past their reply date. */
  cases?: { open: number; overdue: number } | null
  /** The guest's Captain's Circle level (already worded; null for none) and the future cruise credit left. */
  loyalty?: { tier: string | null; creditLeft: Cents } | null
  /** Sailings with a fare on offer. */
  offers?: number | null
  /** Booking steps complete out of all steps, for a booking started. */
  draft?: { done: number; total: number } | null
  medallion?: { stage: 'preparing' | 'shipped' | 'delivered' | 'collect'; activated: boolean; canActivate: boolean } | null
  /** Services the guest can check: how many are down, slow, and in all. */
  status?: { down: number; slow: number; total: number } | null
}

/** The calls a tile needs made before it can speak; a screen's tiles load only the sources they list. */
export type Source = 'checklist' | 'packing' | 'plan' | 'trips' | 'venues' | 'excursions' | 'dining' | 'packages' | 'assistance' | 'today' | 'folio' | 'orders' | 'laundry' | 'wifi' | 'family' | 'clubs' | 'push' | 'cases' | 'loyalty' | 'offers' | 'draft' | 'medallion' | 'status'

/** One tile: the screen path it speaks for, the source it needs and how to word it, or null to say nothing. */
export interface TileDef {
  path: string
  source: Source
  line: (facts: TileFacts, say: Say) => TileLine | null
  /** The line can turn urgent, so its tab wears a dot. Keep this to things that cannot wait: it decides what the tab bar loads on every screen. */
  alert?: boolean
}

const line = (text: string, tone: Tone = 'neutral'): TileLine => ({ text, tone })

/** A progress line that turns to good news when everything is done. */
function progress(key: TileKey, done: number, total: number, say: Say): TileLine | null {
  if (total <= 0) return null
  const d = Math.min(done, total)
  return line(say(key, { done: d, total }), d === total ? 'ok' : 'neutral')
}

/** A request cut-off this close is worth a nudge; further off, the tile stays quiet. */
export const ASSIST_SOON_DAYS = 14

/** The balance line: paid, then due (quiet while far off, a nudge within 30 days, urgent once overdue). */
function paymentLine(p: TileFacts['payment'], say: Say): TileLine | null {
  if (!p) return null
  if (p.state === 'paid') return line(say('tile.payPaid'), 'ok')
  const amount = formatMoney(p.balance)
  if (p.state === 'overdue') return line(say('tile.payOverdue', { amount }), 'urgent')
  const text = p.daysToFinal <= 0 ? say('tile.payToday', { amount }) : say('tile.payDue', { amount, count: p.daysToFinal })
  return line(text, p.state === 'dueSoon' ? 'warn' : 'neutral')
}

/** The drill: done, or still to do (urgent within the hour, a nudge before). */
function musterLine(m: TileFacts['muster'], say: Say): TileLine | null {
  if (!m) return null
  if (m.done) return line(say('tile.musterDone'), 'ok')
  return m.required ? line(say('tile.musterDue', { time: m.time }), m.soon ? 'urgent' : 'warn') : null
}

/** "3h 12m" or "45 min". */
export const minutesText = (minutes: number): string => (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`)

/** All-aboard: the time and what is left, a nudge inside 90 minutes and urgent inside 30. */
function allAboardLine(a: TileFacts['allAboard'], say: Say): TileLine | null {
  if (!a) return null
  return line(say('tile.allAboard', { time: a.time, left: minutesText(a.minutesLeft) }), a.minutesLeft <= 30 ? 'urgent' : a.minutesLeft <= 90 ? 'warn' : 'neutral')
}

function billLine(b: TileFacts['bill'], key: 'tile.billSoFar' | 'tile.billFinal', say: Say): TileLine | null {
  if (!b) return null
  if (b.balance <= 0 && b.pending <= 0) return line(say('tile.billClear'))
  const main = say(key, { amount: formatMoney(Math.max(0, b.balance)) })
  return line(b.pending > 0 ? `${main} · ${say('tile.billPending', { amount: formatMoney(b.pending) })}` : main)
}

/** Children first: not seen for a while is urgent, outside their zones a nudge, otherwise how many are in a club. */
function familyLine(f: TileFacts['family'], say: Say): TileLine | null {
  if (!f) return null
  if (f.overdue.length > 0) return line(f.overdue.length === 1 ? say('tile.familyOverdueOne', { name: f.overdue[0]! }) : say('tile.familyOverdue', { count: f.overdue.length }), 'urgent')
  if (f.outOfZone.length > 0) return line(f.outOfZone.length === 1 ? say('tile.familyOutOne', { name: f.outOfZone[0]! }) : say('tile.familyOut', { count: f.outOfZone.length }), 'warn')
  return f.inClub > 0 ? line(say('tile.familyInClub', { count: f.inClub })) : null
}

function draftLine(d: TileFacts['draft'], say: Say): TileLine | null {
  return d && d.done > 0 ? line(say('tile.draftSteps', { done: d.done, total: d.total })) : null
}

/** Every live tile. Add one entry here (and its words) to give another screen a live line. */
export const TILE_DEFS: readonly TileDef[] = [
  { path: '/plan/checklist', source: 'checklist', line: (f, say) => (f.checklist ? progress('tile.checklist', f.checklist.done, f.checklist.total, say) : null) },
  { path: '/plan/packing', source: 'packing', line: (f, say) => (f.packing ? progress('tile.packing', f.packing.ticked, f.packing.total, say) : null) },
  {
    path: '/plan/reservations',
    source: 'plan',
    line: (f, say) => (typeof f.dinners !== 'number' ? null : line(f.tonight ? say('tile.dinnersTonight', { count: f.dinners, time: f.tonight }) : say('tile.dinners', { count: f.dinners }))),
  },
  {
    path: '/me/documents',
    source: 'trips',
    line: (f, say) => {
      const d = f.documents
      if (!d) return null
      if (d.passportProblems > 0) return line(say('tile.docsPassport', { count: d.passportProblems }), 'warn')
      if (d.missing > 0) return line(say('tile.docsMissing', { count: d.missing }), 'warn')
      return line(say('tile.docsReady'), 'ok')
    },
  },
  {
    path: '/plan/money-plan',
    alert: true,
    source: 'trips',
    line: (f, say) => paymentLine(f.payment, say),
  },
  { path: '/me/payments', alert: true, source: 'trips', line: (f, say) => paymentLine(f.payment, say) },
  {
    path: '/home/check-in',
    source: 'trips',
    line: (f, say) => {
      const c = f.checkin
      if (!c) return null
      if (c.state === 'done') return line(say('tile.checkinDone'), 'ok')
      if (c.state === 'open') return line(say('tile.checkinOpen'), 'warn')
      if (c.state === 'closed') return line(say('tile.checkinClosed'), 'warn')
      return line(c.opensInDays <= 0 ? say('tile.checkinToday') : say('tile.checkinOpens', { count: c.opensInDays }))
    },
  },
  { path: '/home/boarding-pass', source: 'trips', line: (f, say) => (f.checkin?.state === 'done' ? line(say('tile.passReady'), 'ok') : null) },
  {
    path: '/me/trips',
    source: 'trips',
    line: (f, say) => {
      const d = f.daysToDeparture
      if (typeof d !== 'number' || d < 0) return null
      return line(d === 0 ? say('tile.sailsToday') : say('tile.sails', { count: d }))
    },
  },
  {
    path: '/plan/excursions',
    source: 'excursions',
    line: (f, say) => {
      const e = f.excursions
      if (!e) return null
      const parts = [e.booked > 0 ? say('tile.excBooked', { count: e.booked }) : '', e.inCart > 0 ? say('tile.excCart', { count: e.inCart }) : '', e.creditLeft > 0 ? say('tile.excCredit', { amount: formatMoney(e.creditLeft) }) : ''].filter(Boolean)
      return parts.length > 0 ? line(parts.join(' · ')) : null
    },
  },
  {
    path: '/plan/dining',
    source: 'dining',
    line: (f, say) => {
      const d = f.dining
      if (!d) return null
      const parts = [d.seating ? say('tile.diningSeating', { time: d.seating }) : '', d.reservations > 0 ? say('tile.diningBooked', { count: d.reservations }) : '', d.mealsLeft > 0 ? say('tile.diningMeals', { count: d.mealsLeft }) : ''].filter(Boolean)
      return parts.length > 0 ? line(parts.join(' · ')) : null
    },
  },
  { path: '/me/packages', source: 'packages', line: (f, say) => (f.packages && f.packages.bought > 0 ? line(say('tile.pkgBought', { count: f.packages.bought })) : null) },
  {
    path: '/plan/assistance',
    source: 'assistance',
    line: (f, say) => {
      const a = f.assistance
      if (!a) return null
      if (a.waiting > 0) return line(say('tile.assistWaiting', { count: a.waiting }))
      if (a.cutoffDays !== null && a.cutoffDays <= ASSIST_SOON_DAYS) return line(a.cutoffDays === 0 ? say('tile.assistCutoffToday') : say('tile.assistCutoff', { count: a.cutoffDays }), 'warn')
      return null
    },
  },
  { path: '/ship/muster', alert: true, source: 'today', line: (f, say) => musterLine(f.muster, say) },
  { path: '/ship/port', alert: true, source: 'today', line: (f, say) => allAboardLine(f.allAboard, say) },
  { path: '/ship/safe-ashore', alert: true, source: 'today', line: (f, say) => allAboardLine(f.allAboard, say) },
  { path: '/me/bill', source: 'folio', line: (f, say) => billLine(f.bill, 'tile.billSoFar', say) },
  { path: '/me/bill/final', source: 'folio', line: (f, say) => billLine(f.bill, 'tile.billFinal', say) },
  { path: '/me/ledger', source: 'folio', line: (f, say) => (f.bill && f.bill.lines > 0 ? line(say('tile.ledger', { count: f.bill.lines, day: f.bill.throughDay })) : null) },
  {
    path: '/ship/order',
    source: 'orders',
    line: (f, say) => {
      const o = f.orders
      if (!o || o.active === 0) return null
      if (o.needsChoice > 0) return line(say('tile.orderChoice', { count: o.needsChoice }), 'warn')
      return line(o.etaMinutes === null ? say('tile.orderActive', { count: o.active }) : say('tile.orderEta', { count: o.active, minutes: o.etaMinutes }))
    },
  },
  {
    path: '/ship/laundry',
    source: 'laundry',
    line: (f, say) => {
      const l = f.laundry
      if (!l) return null
      if (l.inProgress > 0) return line(say('tile.laundryActive', { count: l.inProgress }))
      return l.freeBagLeft ? line(say('tile.laundryFree')) : null
    },
  },
  {
    path: '/ship/wifi',
    source: 'wifi',
    line: (f, say) => {
      const w = f.wifi
      if (!w) return null
      const parts = [w.expired > 0 ? say('tile.wifiExpired', { count: w.expired }) : '', w.devices > 0 ? say('tile.wifiDevices', { count: w.devices }) : '', w.includedLeft > 0 ? say('tile.wifiIncluded', { count: w.includedLeft }) : ''].filter(Boolean)
      return parts.length > 0 ? line(parts.join(' · '), w.expired > 0 ? 'warn' : 'neutral') : null
    },
  },
  { path: '/ship/family', alert: true, source: 'family', line: (f, say) => familyLine(f.family, say) },
  {
    path: '/plan/clubs',
    source: 'clubs',
    line: (f, say) => (f.clubs && f.clubs.total > 0 ? line(say('tile.clubsRegistered', { registered: f.clubs.registered, total: f.clubs.total }), f.clubs.registered === f.clubs.total ? 'ok' : 'neutral') : null),
  },
  { path: '/me/alerts', source: 'push', line: (f, say) => (f.unread && f.unread > 0 ? line(say('tile.alertsUnread', { count: f.unread })) : null) },
  {
    path: '/me/cases',
    source: 'cases',
    line: (f, say) => {
      const c = f.cases
      if (!c || c.open === 0) return null
      return c.overdue > 0 ? line(say('tile.casesOverdue', { count: c.open }), 'warn') : line(say('tile.casesOpen', { count: c.open }))
    },
  },
  {
    path: '/me/loyalty',
    source: 'loyalty',
    line: (f, say) => {
      const l = f.loyalty
      if (!l) return null
      const parts = [l.tier ?? '', l.creditLeft > 0 ? say('tile.loyaltyCredit', { amount: formatMoney(l.creditLeft) }) : ''].filter(Boolean)
      return parts.length > 0 ? line(parts.join(' · ')) : null
    },
  },
  { path: '/home/offers', source: 'offers', line: (f, say) => (f.offers ? line(say('tile.offers', { count: f.offers })) : null) },
  { path: '/book/:id', source: 'draft', line: (f, say) => draftLine(f.draft, say) },
  { path: '/book/resume/:id', source: 'draft', line: (f, say) => draftLine(f.draft, say) },
  {
    path: '/home/medallion',
    source: 'medallion',
    line: (f, say) => {
      const m = f.medallion
      if (!m) return null
      if (m.activated) return line(say('tile.medallionActive'), 'ok')
      if (m.stage === 'delivered') return m.canActivate ? line(say('tile.medallionActivate'), 'warn') : line(say('tile.medallionDelivered'))
      if (m.stage === 'collect') return line(say('tile.medallionCollect'), 'warn')
      return line(m.stage === 'shipped' ? say('tile.medallionShipped') : say('tile.medallionPreparing'))
    },
  },
  {
    path: '/me/status',
    source: 'status',
    line: (f, say) => {
      const st = f.status
      if (!st || st.total === 0) return null
      if (st.down > 0) return line(say('tile.statusDown', { count: st.down }), 'warn')
      return st.slow > 0 ? line(say('tile.statusSlow', { count: st.slow }), 'warn') : line(say('tile.statusOk'), 'ok')
    },
  },
  { path: '/ship/venues', source: 'venues', line: (f, say) => (typeof f.venuesOpen === 'number' ? line(say('tile.venuesOpen', { count: f.venuesOpen })) : null) },
]

const BY_PATH: ReadonlyMap<string, TileDef> = new Map(TILE_DEFS.map((d) => [d.path, d]))

/** The sources the given screen paths need loaded; paths with no live tile need nothing. */
export function sourcesFor(paths: readonly string[]): ReadonlySet<Source> {
  return new Set(paths.flatMap((p) => { const d = BY_PATH.get(p); return d ? [d.source] : [] }))
}

/** The live line of each screen path that has one and enough facts to say it; a screen with nothing to say is left out. */
export function tileLines(facts: TileFacts, say: Say): Record<string, TileLine> {
  const out: Record<string, TileLine> = {}
  for (const d of TILE_DEFS) {
    const l = d.line(facts, say)
    if (l) out[d.path] = l
  }
  return out
}

const RANK: Record<Tone, number> = { urgent: 0, warn: 1, ok: 2, neutral: 2 }

/** The items with those that need the guest (urgent, then warn) first; everything else keeps its order. */
export function floatByTone<T>(items: readonly T[], toneOf: (item: T) => Tone | undefined): T[] {
  return items.map((item, i) => ({ item, i, r: RANK[toneOf(item) ?? 'neutral'] })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.item)
}

/** The tabs that should wear a dot: those holding a screen whose live line is urgent. `tabs` lists each tab's key and the screen paths it holds. */
export function tabsNeedingAttention(tabs: readonly { key: string; paths: readonly string[] }[], live: Record<string, TileLine>): Set<string> {
  return new Set(tabs.filter((t) => t.paths.some((p) => live[p]?.tone === 'urgent')).map((t) => t.key))
}

/** The paths whose line can turn urgent: all the tab bar needs to load to know which tabs get a dot. */
export const alertPaths = (paths: readonly string[]): string[] => paths.filter((p) => BY_PATH.get(p)?.alert)

/** The tile asks for attention (the badge on Home): only an urgent line does. */
export const needsAttention = (l: TileLine | undefined): boolean => l?.tone === 'urgent'

/** The guest's calendar date on the device, "YYYY-MM-DD". */
export function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The earliest dinner on the day whose date is `today` ("YYYY-MM-DD"), or null. */
export function tonightsDinner(days: readonly { date: string; entries: readonly { kind: string; time: string }[] }[], today: string): string | null {
  const times = days.filter((d) => d.date === today).flatMap((d) => d.entries.filter((e) => e.kind === 'dinner').map((e) => e.time)).sort()
  return times[0] ?? null
}

/** The balance fact for a confirmed booking, from its payment state and plan. */
export function paymentFact(trip: { payment: PaymentState; plan: { balance: Cents } } | null | undefined, daysToFinal: number): TileFacts['payment'] {
  return trip ? { state: trip.payment, balance: trip.plan.balance, daysToFinal } : null
}

/** The check-in fact, with whole days until it opens counted up so "tomorrow" is 1 and never 0 while still closed. */
export function checkinFact(c: { state: 'notOpen' | 'open' | 'closed' | 'done'; opensAt: number } | null | undefined, now: number): TileFacts['checkin'] {
  return c ? { state: c.state, opensInDays: Math.max(0, Math.ceil((c.opensAt - now) / 86_400_000)) } : null
}

/** The excursions fact: tours still booked (cancelled ones left out), lines in the cart and credit left. */
export function excursionsFact(v: { booked: readonly { status: string }[]; cart: readonly unknown[]; creditLeft: Cents } | null | undefined): TileFacts['excursions'] {
  return v ? { booked: v.booked.filter((b) => b.status === 'booked').length, inCart: v.cart.length, creditLeft: v.creditLeft } : null
}

/** The dining fact: the fixed seating if any, reservations made and specialty dinners still covered. */
export function diningFact(v: { seating: string | null; reservations: readonly unknown[]; mealsLeft: number } | null | undefined): TileFacts['dining'] {
  return v ? { seating: v.seating, reservations: v.reservations.length, mealsLeft: v.mealsLeft } : null
}

/** The packages fact: purchases still active (cancelled ones left out). */
export function packagesFact(v: { purchases: readonly { status: string }[] } | null | undefined): TileFacts['packages'] {
  return v ? { bought: v.purchases.filter((p) => p.status === 'active').length } : null
}

/** The assistance fact: requests still waiting for confirmation, and the nearest cut-off ahead among kinds not yet asked for. */
export function assistanceFact(v: { requests: readonly { kind: string; status: string }[]; deadlines: readonly { kind: string; deadline: { daysLeft: number } }[] } | null | undefined): TileFacts['assistance'] {
  if (!v) return null
  const asked = v.requests.map((r) => r.kind)
  const ahead = v.deadlines.filter((d) => d.deadline.daysLeft >= 0 && !asked.includes(d.kind)).map((d) => d.deadline.daysLeft)
  return { waiting: v.requests.filter((r) => r.status === 'received').length, cutoffDays: ahead.length > 0 ? Math.min(...ahead) : null }
}

/** The drill fact: ship-time label, and whether it is due within the hour (or past). Null when the day has no drill. */
export function musterFact(m: { required: boolean; done: boolean; at: number } | null | undefined, shipZone: string, now: number): TileFacts['muster'] {
  return m ? { done: m.done, required: m.required, time: clock12(timeIn(m.at, shipZone)), soon: m.at - now <= 3_600_000 } : null
}

/** The all-aboard fact: only while the ship is in port (after arrival, before all-aboard). Minutes round up so the last minute reads "1 min". */
export function allAboardFact(p: { arriveAt: number; allAboardAt: number; allAboardShip: string } | null | undefined, now: number): TileFacts['allAboard'] {
  if (!p || now < p.arriveAt || now >= p.allAboardAt) return null
  return { time: p.allAboardShip, minutesLeft: Math.max(1, Math.ceil((p.allAboardAt - now) / 60_000)) }
}

/** The account fact from the folio's totals and lines. */
export function billFact(v: { lines: readonly unknown[]; totals: { balance: Cents; pending: Cents }; throughDay: number } | null | undefined): TileFacts['bill'] {
  return v ? { balance: v.totals.balance, pending: v.totals.pending, lines: v.lines.length, throughDay: v.throughDay } : null
}

/** The orders fact: orders not yet delivered or cancelled, those waiting on the guest, and the soonest estimate in whole minutes ahead. */
export function ordersFact(list: readonly { stage: string; etaAt: number | null }[] | null | undefined, now: number): TileFacts['orders'] {
  if (!list) return null
  const active = list.filter((o) => o.stage !== 'delivered' && o.stage !== 'cancelled')
  const etas = active.filter((o) => o.etaAt !== null && o.etaAt > now).map((o) => Math.ceil((o.etaAt! - now) / 60_000))
  return { active: active.length, needsChoice: active.filter((o) => o.stage === 'needsChoice').length, etaMinutes: etas.length > 0 ? Math.min(...etas) : null }
}

export function laundryFact(v: { requests: readonly { stage: string }[]; freeBagLeft: boolean } | null | undefined): TileFacts['laundry'] {
  return v ? { inProgress: v.requests.filter((r) => r.stage === 'requested' || r.stage === 'cleaning').length, freeBagLeft: v.freeBagLeft } : null
}

export function wifiFact(v: { devices: readonly { expired: boolean }[]; includedLeft: number } | null | undefined): TileFacts['wifi'] {
  return v ? { devices: v.devices.filter((d) => !d.expired).length, expired: v.devices.filter((d) => d.expired).length, includedLeft: v.includedLeft } : null
}

/** The family fact: first names of children not seen for a while or outside their zones, and how many are in a club. */
export function familyFact(v: { kids: readonly { name: string; status: string }[] } | null | undefined): TileFacts['family'] {
  if (!v) return null
  const first = (k: { name: string }) => k.name.split(' ')[0] ?? k.name
  return { overdue: v.kids.filter((k) => k.status === 'overdue').map(first), outOfZone: v.kids.filter((k) => k.status === 'outOfZone').map(first), inClub: v.kids.filter((k) => k.status === 'inClub').length }
}

export function clubsFact(v: { children: readonly { registered: boolean }[] } | null | undefined): TileFacts['clubs'] {
  return v ? { registered: v.children.filter((c) => c.registered).length, total: v.children.length } : null
}

export function unreadFact(v: { unread: number } | null | undefined): TileFacts['unread'] {
  return v ? v.unread : null
}

/** The cases fact: cases not yet resolved or withdrawn, and those past their reply date. */
export function casesFact(v: { cases: readonly { stage: string; dueAt: number }[] } | null | undefined, now: number): TileFacts['cases'] {
  if (!v) return null
  const open = v.cases.filter((c) => c.stage === 'received' || c.stage === 'inReview')
  return { open: open.length, overdue: open.filter((c) => c.dueAt < now).length }
}

/** The loyalty fact; `tierLabel` is the level already worded, and "none" is left unsaid. */
export function loyaltyFact(v: { tier: string; creditLeft: Cents } | null | undefined, tierLabel: (tier: string) => string): TileFacts['loyalty'] {
  return v ? { tier: v.tier === 'none' ? null : tierLabel(v.tier), creditLeft: v.creditLeft } : null
}

/** The booking fact: steps complete before the first that is not, out of all steps. */
export function draftFact(draft: Draft | null | undefined, ctx: StepContext): TileFacts['draft'] {
  return draft ? { done: STEPS.indexOf(firstIncomplete(draft, ctx)), total: STEPS.length } : null
}

export function medallionFact(v: { stage: 'preparing' | 'shipped' | 'delivered' | 'collect'; activatedAt: number | null; canActivate: boolean } | null | undefined): TileFacts['medallion'] {
  return v ? { stage: v.stage, activated: v.activatedAt !== null, canActivate: v.canActivate } : null
}

export function statusFact(v: readonly { health: string }[] | null | undefined): TileFacts['status'] {
  return v ? { down: v.filter((x) => x.health === 'down').length, slow: v.filter((x) => x.health === 'slow').length, total: v.length } : null
}
