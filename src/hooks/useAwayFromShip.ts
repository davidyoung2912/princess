import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { OnboardToday } from '../api/types'
import { awayPackRunning, awayPackVersion, captureAwayPack, readAwayPack, subscribeAwayPack } from '../data/awayPack'
import { awayPackStatus, inPortWindow, isAway, type AwayPackStatus } from '../domain/awayFromShip'
import { dayOf, setPresence, type Presence } from '../domain/portParty'
import { useNow, usePersona } from './useDemo'
import { useOnboardToday } from './useOnboardToday'
import { usePort } from './usePort'

export type PortToday = NonNullable<OnboardToday['portDay']>

export interface AwayFromShip {
  /** The port day in progress (docked and not yet sailed), or null. */
  day: PortToday | null
  /** What the guest last said: leaving or ashore, back aboard, or nothing yet today. */
  presence: Presence | null
  /** When they said it. */
  at: number | null
  away: boolean
  pack: AwayPackStatus
  saving: boolean
  /** "I'm leaving the ship": records it (shared with the travel party) and saves the copy for use with no signal straight away. */
  leave: () => void
  /** "I'm back aboard": by hand today, and what a gangway scan will do. */
  back: () => void
  /** Makes the copy again. */
  save: () => void
}

/** The guest's side of a port day: are they away, what is saved for them, and the two things they can say. */
export function useAwayFromShip(): AwayFromShip {
  const me = usePersona()
  const now = useNow()
  const today = useOnboardToday()
  const { state, update } = usePort()
  useSyncExternalStore(subscribeAwayPack, awayPackVersion, awayPackVersion)
  const portDay = today.data?.portDay ?? null
  const day = portDay && inPortWindow(portDay, now) ? portDay : null
  const entry = me && day ? dayOf(state.party, day.date).presence[me.id] ?? null : null
  const presence = entry?.status ?? null
  const away = isAway(presence)
  const personId = me?.id ?? null
  const booker = me?.booker ?? 'none'
  const date = day?.date ?? null
  const record = personId ? readAwayPack({ id: personId, booker }) : null
  const pack = awayPackStatus(record, date ?? '')
  const saving = awayPackRunning()
  const save = useCallback(() => { if (personId && date) void captureAwayPack({ id: personId, booker }, date) }, [personId, booker, date])
  const say = (status: Presence) => { if (me && day) update((s) => ({ ...s, party: setPresence(s.party, day.date, me.id, status, now) })) }
  // A reload, or a second device of the same booking, finds the guest already away with no copy made for today: make it there too. A copy that
  // was tried and failed (no signal) still counts as tried, so this never loops; the guest saves again by hand.
  const tried = record?.date === date
  useEffect(() => {
    if (away && !tried && !saving) save()
  }, [away, tried, saving, save])
  return { day, presence, at: entry?.at ?? null, away, pack, saving, save, leave: () => { say('ashore'); save() }, back: () => say('back') }
}
