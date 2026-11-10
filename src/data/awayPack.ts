import { asBoardingView, asDiningView, asMusterView, asOnboardToday, asPortDayCopy } from '../api/guards'
import { demoNow } from '../demo/store'
import { AWAY_PACK_KINDS, normalizeAwayPack, type AwayPackKind, type AwayPackResult } from '../domain/awayFromShip'
import { cacheGet, cachePut } from '../domain/offlineCache'
import { isEmergencyCard } from '../domain/safety'
import { api } from '../runtime'
import { shouldKeep } from './capsule'

/**
 * Away From Ship: the copy of what a guest wants with no signal, made the moment they leave the ship. Each piece is kept under the same key the screen that
 * shows it already reads (so those screens work offline too), and one small record says what was kept, when and for which port day.
 */
const storage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export interface PackPerson { id: string; booker: string }

interface Piece { kind: AwayPackKind; key: (p: PackPerson) => string; load: () => Promise<unknown> }

const PIECES: readonly Piece[] = [
  { kind: 'today', key: (p) => p.id, load: () => api.onboard.today() },
  { kind: 'portDay', key: (p) => p.booker, load: async () => ({ view: await api.onboard.portDay() }) },
  { kind: 'pass', key: (p) => p.booker, load: () => api.boarding.pass() },
  { kind: 'muster', key: (p) => p.booker, load: () => api.onboard.muster() },
  { kind: 'emergency', key: (p) => p.id, load: () => api.onboard.emergency() },
  { kind: 'dining', key: (p) => p.booker, load: () => api.plan.dining.view() },
]

const CHECKS: Record<AwayPackKind, (raw: unknown) => unknown> = {
  today: asOnboardToday, portDay: asPortDayCopy, pass: asBoardingView, muster: asMusterView, emergency: (raw) => (isEmergencyCard(raw) ? raw : null), dining: asDiningView,
}

const RECORD_KIND = 'awaypack'

/** The record of the last copy made for this person on this device, or null. */
export const readAwayPack = (p: PackPerson): AwayPackResult | null => cacheGet(storage(), RECORD_KIND, p.id, normalizeAwayPack)?.value ?? null

// A small store, so every screen showing the copy sees it start, finish and fail together.
let running = false
let version = 0
const listeners = new Set<() => void>()
const emit = () => { version += 1; listeners.forEach((l) => l()) }
export const subscribeAwayPack = (l: () => void): (() => void) => { listeners.add(l); return () => listeners.delete(l) }
export const awayPackVersion = (): number => version
export const awayPackRunning = (): boolean => running

/**
 * Fetches every piece at once and keeps what arrives. A piece that fails (no signal, or a server answer that does not check out) is recorded as missing and
 * any older copy of it is left alone. Resolves to the record; a second call while one is running does nothing and returns null.
 */
export async function captureAwayPack(person: PackPerson, date: string): Promise<AwayPackResult | null> {
  if (running) return null
  running = true
  emit()
  try {
    const at = demoNow()
    const items = await Promise.all(PIECES.map(async (piece) => {
      try {
        const value = await piece.load()
        if (CHECKS[piece.kind](value) === null) return { kind: piece.kind, ok: false }
        if (shouldKeep(piece.kind)) cachePut(storage(), piece.kind, piece.key(person), value, at)
        return { kind: piece.kind, ok: true }
      } catch {
        return { kind: piece.kind, ok: false }
      }
    }))
    const result: AwayPackResult = { at, date, items: AWAY_PACK_KINDS.map((kind) => items.find((i) => i.kind === kind) ?? { kind, ok: false }) }
    cachePut(storage(), RECORD_KIND, person.id, result, at)
    return result
  } finally {
    running = false
    emit()
  }
}
