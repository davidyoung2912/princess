import { levelAt, PULSE_VENUES, quietSpaces, type PulseEnv, type QuietResult } from './pulse'
import { minutesOf, hhmmOf, type PlanRow } from './planChange'

/**
 * Inclusion (XI-01 to XI-05): sensory profile and plan, social story and visual schedule, sensory kit request, and the cognitive and caregiver support mode.
 * Calm mode itself is a setting (`Settings.calm`); the rest is kept on the device per person. Authored content is plain and marked where the line's own offer must be checked.
 */
export type Level = 'low' | 'any'
export interface SensoryProfile { noise: Level; light: Level; crowd: Level; touch: Level }
export const EMPTY_PROFILE: SensoryProfile = { noise: 'any', light: 'any', crowd: 'any', touch: 'any' }
export const PROFILE_KEYS: readonly (keyof SensoryProfile)[] = ['noise', 'light', 'crowd', 'touch']

const isLevel = (v: unknown): v is Level => v === 'low' || v === 'any'
export function normalizeProfile(raw: unknown): SensoryProfile {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { noise: isLevel(o.noise) ? o.noise : 'any', light: isLevel(o.light) ? o.light : 'any', crowd: isLevel(o.crowd) ? o.crowd : 'any', touch: isLevel(o.touch) ? o.touch : 'any' }
}

/** Loud moments to warn about (XI-02). By event id, with what is loud about it. */
export const LOUD_MOMENTS: Readonly<Record<string, string>> = {
  muster: 'The general alarm sounds during the drill, and a spoken announcement follows.',
  sailaway: 'The ship’s horn sounds at sail-away, with music on deck.',
  'port-music': 'Steel drums are played live on deck, close to the pool.',
  'dome-dj': 'A dance party with loud music and flashing lights.',
  'dome-show': 'An acrobatic show with loud music and bright lights.',
  'teen-night': 'A dance night with loud music.',
  'welcome-show': 'A large theatre show with loud music and bright lights.',
  'stage-show': 'A large theatre show with loud music and bright lights.',
  'stage-early': 'A large theatre show with loud music and bright lights.',
  'port-show': 'A large theatre show with loud music and bright lights.',
  'farewell-show': 'A large theatre show with loud music and bright lights.',
  bingo: 'A full room with calls over a loudspeaker.',
}

export type WarnKind = 'noise' | 'light' | 'crowd'
export interface SensoryWarning { id: string; title: string; start: string; kind: WarnKind; text: string }

export interface SensoryPlan {
  warnings: SensoryWarning[]
  /** Half-hour windows across the day (08:00 to 21:00) when the ship is calmest, up to three, in time order. */
  quietWindows: { start: string; level: number }[]
  spaces: QuietResult[]
  /** A quiet lane is recommended at boarding. */
  quietLane: boolean
}

const LIGHT_WORDS = /lights|flashing|bright/i

export function sensoryPlan(profile: SensoryProfile, rows: readonly PlanRow[], dayStartAt: number, now: number, env: PulseEnv): SensoryPlan {
  const warnings: SensoryWarning[] = []
  for (const r of rows.filter((x) => x.state !== 'dropped')) {
    const loud = LOUD_MOMENTS[r.entry.id]
    const w = (kind: WarnKind, text: string) => warnings.push({ id: r.entry.id, title: r.entry.title, start: r.entry.start, kind, text })
    if (loud && profile.noise === 'low') w('noise', loud)
    if (loud && profile.light === 'low' && LIGHT_WORDS.test(loud)) w('light', loud)
    if (profile.crowd === 'low' && r.entry.placeId) {
      const venue = PULSE_VENUES.find((v) => v.id === r.entry.placeId)
      if (venue && levelAt(venue.id, dayStartAt + minutesOf(r.entry.start) * 60_000, env) >= 65) w('crowd', 'This venue is usually busy at that time.')
    }
  }
  const windows: { start: string; level: number }[] = []
  for (let m = 8 * 60; m <= 20 * 60 + 30; m += 30) {
    const at = dayStartAt + m * 60_000
    windows.push({ start: hhmmOf(m), level: Math.round(PULSE_VENUES.reduce((n, v) => n + levelAt(v.id, at, env), 0) / PULSE_VENUES.length) })
  }
  const quietWindows = windows.sort((a, b) => a.level - b.level || a.start.localeCompare(b.start)).slice(0, 3).sort((a, b) => a.start.localeCompare(b.start))
  return { warnings, quietWindows, spaces: quietSpaces(now, env).filter((q) => q.noise <= 2).slice(0, 3), quietLane: profile.crowd === 'low' || profile.noise === 'low' }
}

/** The social story (XI-03): the trip as a short series of plain steps, what will be seen and heard, and what is expected. */
export interface StoryStep { id: string; title: string; happens: string; sounds: string; yourPart: string }
export const STORY: readonly StoryStep[] = [
  { id: 'travel', title: 'Getting to the ship', happens: 'You travel to the port by car, taxi or plane.', sounds: 'Engines, announcements and many people talking.', yourPart: 'Keep your papers and phone where you can reach them.' },
  { id: 'terminal', title: 'The terminal', happens: 'You wait in a big building with a line of people.', sounds: 'Chatter and announcements. It can be crowded.', yourPart: 'Stand in the line. A quiet lane is available if you ask.' },
  { id: 'photo', title: 'The photo and the card', happens: 'A person takes your photo and checks your papers.', sounds: 'Short and quiet. It takes about a minute.', yourPart: 'Look at the camera and say hello.' },
  { id: 'gangway', title: 'Walking onto the ship', happens: 'You walk up a ramp. The floor moves a little.', sounds: 'Music may play and crew say welcome.', yourPart: 'Walk with your family. You can hold the rail.' },
  { id: 'muster', title: 'The safety drill', happens: 'Everyone goes to a meeting place and learns what to do in an emergency.', sounds: 'A loud alarm sounds once, then a voice speaks.', yourPart: 'Stay with your family and listen. Ear defenders are allowed.' },
  { id: 'cabin', title: 'Your cabin', happens: 'You find your room. It is your own quiet place.', sounds: 'Quiet, with a low hum from the ship.', yourPart: 'You can rest here whenever you like.' },
  { id: 'dinner', title: 'Dinner', happens: 'You sit at a table and a server brings food.', sounds: 'Plates, talking and sometimes music.', yourPart: 'Choose from the menu. You can ask for something plain.' },
  { id: 'sail', title: 'Sailing away', happens: 'The ship leaves the port.', sounds: 'The ship’s horn is very loud. Music plays on deck.', yourPart: 'You can watch from your balcony or stay inside.' },
]

export type ScheduleKind = 'now' | 'next' | 'later'
export interface ScheduleCard { kind: ScheduleKind; id: string; title: string; start: string; /** What changed, when it did. */ changed: string | null }

/** "Now, next, later" (XI-03): the item under way, the one after it, and up to three more. A change is named with the time it was before. */
export function visualSchedule(rows: readonly PlanRow[], nowHhmm: string): ScheduleCard[] {
  const m = minutesOf(nowHhmm)
  const list = rows.filter((r) => r.state !== 'dropped')
  const card = (r: PlanRow, kind: ScheduleKind): ScheduleCard => ({ kind, id: r.entry.id, title: r.entry.title, start: r.entry.start, changed: r.state === 'moved' && r.was ? `Moved from ${r.was}` : r.state === 'added' ? 'New' : null })
  const current = list.find((r) => minutesOf(r.entry.start) <= m && m < minutesOf(r.entry.start) + r.entry.minutes)
  const ahead = list.filter((r) => minutesOf(r.entry.start) > m)
  const out: ScheduleCard[] = []
  if (current) out.push(card(current, 'now'))
  if (ahead[0]) out.push(card(ahead[0], 'next'))
  for (const r of ahead.slice(1, 4)) out.push(card(r, 'later'))
  return out
}

/** The sensory kit request (XI-04). Whether the line lends these items must be checked; the status after the request is a simulation. */
export const KIT_ITEMS = ['headphones', 'fidget', 'lanyard'] as const
export type KitItem = (typeof KIT_ITEMS)[number]
export interface KitRequest { items: KitItem[]; requestedAt: number }
export type KitStatus = 'requested' | 'confirmed'
export const KIT_CONFIRM_AFTER_MIN = 60

export function requestKit(items: readonly KitItem[], now: number): KitRequest | null {
  const unique = KIT_ITEMS.filter((i) => items.includes(i))
  return unique.length === 0 ? null : { items: unique, requestedAt: now }
}
export const kitStatus = (r: KitRequest, now: number): KitStatus => (now - r.requestedAt >= KIT_CONFIRM_AFTER_MIN * 60_000 ? 'confirmed' : 'requested')

export function normalizeKit(raw: unknown): KitRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.requestedAt !== 'number' || !Array.isArray(o.items)) return null
  return requestKit(o.items.filter((i): i is KitItem => KIT_ITEMS.includes(i as KitItem)), o.requestedAt)
}

/** The caregiver link (XI-05). It needs the guest's consent, or a stated legal authority, and shows only what is listed here. Never a location. */
export type Authority = 'guest' | 'legal'
export interface Caregiver { name: string; authority: Authority; consentedAt: number }
export const CAREGIVER_SEES: readonly string[] = ['today’s schedule', 'when a change is made to it', 'the cabin number']
export const CAREGIVER_NEVER: readonly string[] = ['where the guest is', 'the bill', 'messages']

export function addCaregiver(name: string, authority: Authority, consent: boolean, now: number): { ok: true; caregiver: Caregiver } | { ok: false; problem: 'name' | 'consent' } {
  const n = name.trim()
  if (!n) return { ok: false, problem: 'name' }
  if (!consent) return { ok: false, problem: 'consent' }
  return { ok: true, caregiver: { name: n.slice(0, 60), authority, consentedAt: now } }
}

export function normalizeCaregiver(raw: unknown): Caregiver | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.name !== 'string' || !o.name.trim() || typeof o.consentedAt !== 'number') return null
  return { name: o.name.slice(0, 60), authority: o.authority === 'legal' ? 'legal' : 'guest', consentedAt: o.consentedAt }
}

export interface CalmState { profile: SensoryProfile; kit: KitRequest | null; caregiver: Caregiver | null; cognitive: boolean; storyDone: string[] }
export const EMPTY_CALM: CalmState = { profile: EMPTY_PROFILE, kit: null, caregiver: null, cognitive: false, storyDone: [] }

export function normalizeCalm(raw: unknown): CalmState {
  if (!raw || typeof raw !== 'object') return EMPTY_CALM
  const o = raw as Record<string, unknown>
  const ids = new Set(STORY.map((s) => s.id))
  return {
    profile: normalizeProfile(o.profile), kit: normalizeKit(o.kit), caregiver: normalizeCaregiver(o.caregiver), cognitive: o.cognitive === true,
    storyDone: Array.isArray(o.storyDone) ? o.storyDone.filter((i): i is string => typeof i === 'string' && ids.has(i)) : [],
  }
}
