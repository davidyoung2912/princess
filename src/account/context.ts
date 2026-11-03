import type { PackageId, Person, Tier } from '../domain/people'
import { JOURNEY_STAGES, type JourneyStage } from '../routes/hubs'

/** A person on the trip, as `GET /me/context` describes them. */
export interface ContextPerson { id: string; name: string; firstName: string; age: number | null; child: boolean; booker: string; tier: Tier }

export interface ContextBooking { number: string; sailingId: string; package: PackageId; category: string }

/** Who is signed in, who is on their trip, which sailing they are on and what time the server says it is. Nothing here is kept on the device. */
export interface AccountContext {
  person: ContextPerson
  party: ContextPerson[]
  booking: ContextBooking | null
  /** The current trip's sailing; for a demo account the one it chose. */
  sailingId: string | null
  /** A demo account's pretend phone zone (null for everyone else). */
  phoneZone: string | null
  isDemo: boolean
  /** The journey stage the server worked out from what the guest has done and where the sailing is in time (stage-experience-plan.md section 3); null from an older server. */
  stage: JourneyStage | null
  /** The sailing the stage is about: null while dreaming. */
  focusSailingId: string | null
  /** The one event that put the guest in this stage, as a stable code ("sailingSaved", "paidInFull"...). */
  stageReason: string | null
  /** Server time minus this device's time when the answer arrived (ms): add it to `Date.now()` to get the server's now. */
  offsetMs: number
}

const TIERS: readonly Tier[] = ['none', 'gold', 'ruby', 'platinum', 'elite']
const PACKAGES: readonly PackageId[] = ['none', 'plus', 'premier']

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

function normalizePerson(raw: unknown): ContextPerson | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id)
  if (!id) return null
  const firstName = str(o.firstName) ?? ''
  const tier = TIERS.find((t) => t === o.tier) ?? 'none'
  return {
    id,
    name: str(o.name) ?? firstName,
    firstName,
    age: typeof o.age === 'number' && Number.isFinite(o.age) ? Math.max(0, Math.trunc(o.age)) : null,
    child: o.child === true,
    booker: str(o.booker) ?? id,
    tier,
  }
}

/** The server's answer from untrusted data; null when it is not one. `deviceNow` is this device's clock when the answer arrived. */
export function normalizeContext(raw: unknown, deviceNow: number): AccountContext | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const person = normalizePerson(o.person)
  if (!person || typeof o.nowMs !== 'number' || !Number.isFinite(o.nowMs)) return null
  const party = Array.isArray(o.party) ? o.party.map(normalizePerson).filter((p): p is ContextPerson => p !== null) : []
  const b = o.booking && typeof o.booking === 'object' ? (o.booking as Record<string, unknown>) : null
  const booking: ContextBooking | null = b && str(b.number) && str(b.sailingId)
    ? { number: str(b.number)!, sailingId: str(b.sailingId)!, package: PACKAGES.find((p) => p === b.package) ?? 'none', category: str(b.category) ?? '' }
    : null
  return { person, party, booking, sailingId: str(o.sailingId), phoneZone: str(o.phoneZone), isDemo: o.isDemo === true,
    stage: JOURNEY_STAGES.find((x) => x === o.stage) ?? null, focusSailingId: str(o.focusSailingId), stageReason: str(o.stageReason), offsetMs: o.nowMs - deviceNow }
}

/** A screen's `Person` from the context. The server does not hold a role, stateroom or text size for a person, so those get neutral values. */
export function personFrom(c: AccountContext): Person {
  const p = c.person
  return {
    id: p.id, name: p.name, firstName: p.firstName, age: p.age ?? 30, group: 'solo', role: '', booker: p.booker, tier: p.tier,
    package: c.booking?.package ?? 'none', stateroom: 'balcony', sanctuary: false, child: p.child, defaultTextSize: 'standard', summary: '',
  }
}

/** First name of anyone on the signed-in person's trip, else ''. */
export function firstNameIn(c: AccountContext | null, id: string): string {
  return c?.party.find((x) => x.id === id)?.firstName || (c?.person.id === id ? c.person.firstName : '') || ''
}

/** The booker of someone on the signed-in person's trip, else the person's own id (a booking's stores are kept under its booker). */
export function bookerIn(c: AccountContext | null, id: string): string {
  return c?.party.find((x) => x.id === id)?.booker ?? (c?.person.id === id ? c.person.booker : id)
}

let current: AccountContext | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const getContext = (): AccountContext | null => current
export const subscribeContext = (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** Takes the server's answer (null clears it, at sign-out). */
export function setContext(c: AccountContext | null): void {
  current = c
  if (c) realAccount = !c.isDemo
  emit()
}

/** Whether the signed-in account is a real one (true), a demo one (false) or nobody / unknown (null). Known from the sign-in, before the context arrives. */
let realAccount: boolean | null = null
export function markAccount(isDemo: boolean | null): void { realAccount = isDemo === null ? null : !isDemo }

/** True for a signed-in real (not demo) account: its time and sailing come from the server, not from the demo controls. */
export const followsServer = (): boolean => (current ? !current.isDemo : realAccount === true)

/** The server's "now" in ms, from this device's clock and the offset measured when the context arrived. */
export const serverNow = (deviceNow: number = Date.now()): number => deviceNow + (current?.offsetMs ?? 0)

/** First name of anyone on the signed-in person's trip, or '' when unknown. */
export const personFirstName = (id: string): string => firstNameIn(current, id)

/** Everyone on the same trip as `id`, including `id`: the server's party. Empty when `id` is not on the signed-in person's trip. */
export function partyPeople(id: string): Person[] {
  const c = current
  if (c && c.party.length > 0 && (c.person.id === id || c.party.some((p) => p.id === id))) return c.party.map((p) => personFrom({ ...c, person: p }))
  return []
}

/** The booker of someone on the signed-in person's trip, else their own id. */
export const bookerOfPerson = (id: string | null): string | null => (id === null ? null : bookerIn(current, id))

/**
 * Fetches the context and keeps it. `get` returns the server's answer (ids already in the client's form). The offset is measured from the middle of the
 * round trip. An answer that arrives after the person has changed (`stillCurrent` false) is dropped. True when a context was kept.
 */
export async function refreshContext(get: () => Promise<unknown>, stillCurrent: () => boolean = () => true, now: () => number = Date.now): Promise<boolean> {
  const sent = now()
  try {
    const raw = await get()
    if (!stillCurrent()) return false
    const c = normalizeContext(raw, Math.round((sent + now()) / 2))
    if (!c) return false
    setContext(c)
    return true
  } catch { return false }
}
