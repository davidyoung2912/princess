import { useSyncExternalStore } from 'react'
import { asProgramView } from '../api/guards'
import { goodTime } from '../domain/pulse'
import { modeFor, type GoodNow, modeSteps, modeView, type ModeFacts, type ModeId, type ModeView } from '../ai/stanleyModes'
import { disembarkTimes } from '../domain/disembark'
import { shipZoneAt } from '../domain/sailings'
import { api } from '../runtime'
import { isSeen, markSeen, seenVersion, subscribeSeen } from '../settings/stanleySeen'
import { buildJourney, windowOpensAt } from '../domain/journey'
import { useTrip } from './useTrip'
import { useNow, usePersona, useSailing } from './useDemo'
import { useSavedCopy } from './useSavedCopy'
import { usePulseEnv } from './useServedFeeds'
import { useJourneyPosition } from './useJourneyPosition'
import { useMine } from './useMine'
import { useOnboardToday } from './useOnboardToday'
import type { TripView } from '../api/types'

const pickTrip = (upcoming: readonly TripView[]): TripView | null => upcoming.find((x) => x.kind === 'current') ?? upcoming[0] ?? null

/** What a step is ticked under on this device: the mode, the day it is for and the step (kept in the "seen" store, so "Reset Tips" clears it). */
export const tickKey = (mode: ModeId, subject: string, step: string): string => `mode:${mode}:${subject}:${step}`

export interface StanleyModeState {
  mode: ModeId | null
  view: ModeView
  /** What the ticks are filed under today (the date on the ship, or on the guest's own clock before boarding). */
  subject: string
  /** The ship's clock zone for showing times. */
  zone: string
  tick: (step: string) => void
  /** Sea day only: the pool is quiet now or at a later time. */
  goodNow: GoodNow | null
}

const EMPTY: ModeView = { steps: [], current: null, later: [], finished: [], minutesTo: null }

/** The mode that is on now and its steps, made from data the app already holds: the trip, today on board, the sailing and the clock. Nothing new is fetched. */
export function useStanleyMode(forced?: ModeId): StanleyModeState {
  useSyncExternalStore(subscribeSeen, seenVersion, seenVersion)
  const pos = useJourneyPosition()
  const sailing = useSailing()
  const now = useNow()
  const trips = useMine(() => api.trips.list())
  const today = useOnboardToday()
  const me = usePersona()
  const { state: tripState } = useTrip()
  const cruiseDay = pos.day?.kind === 'cruiseDay' ? pos.day.day : 1
  const program = useSavedCopy('program', `${me?.id ?? 'none'}:${cruiseDay}`, () => api.onboard.program(cruiseDay), asProgramView, [me?.id, cruiseDay])
  const { env, now: pulseNow } = usePulseEnv(sailing, now, cruiseDay)
  const trip = trips.data ? pickTrip(trips.data.upcoming) : null
  const zone = shipZoneAt(sailing, now)
  const aboard = !!today.data?.aboard
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hour12: false }).format(now)) % 24
  const lastFullDay = pos.day?.kind === 'cruiseDay' && pos.day.day >= pos.day.of - 1
  const found = modeFor({ stage: pos.stage, daysToDeparture: trip?.daysToDeparture, lastFullDay, hour, aboard })
  const mode = forced ?? found
  const facts: ModeFacts = {}
  if (mode === 'boardingDay') {
    const plan = { ...tripState.journey.plan, windowStart: tripState.embark.window }
    facts.boardingDay = { checkinDone: trip?.checkin.state === 'done', leaveAt: buildJourney(plan, sailing.departure, 0).leaveBy, terminalAt: windowOpensAt(sailing.departure, plan.windowStart) }
  }
  const td = today.data
  if (mode === 'firstFour' && td) facts.firstFour = { musterAt: td.muster.at, musterDone: td.muster.done, sailAwayAt: td.sailAwayAt }
  if (mode === 'portDay' && td?.portDay) facts.portDay = { allAboardAt: td.portDay.allAboardAt, arriveAt: td.portDay.arriveAt, tender: td.portDay.tender, skipped: false }
  if (mode === 'lastMorning' && sailing.id) {
    const d = disembarkTimes(sailing)
    facts.lastMorning = { tipBy: d.tipBy, bagsOutAt: d.bagsOutAt, arrivalAt: d.arrivalAt, vacateAt: d.vacateAt }
  }
  if (mode === 'seaDay' && program.data) {
    const mine = program.data.events.filter((e) => program.data!.mine.includes(e.id) && e.status !== 'cancelled' && e.endAt > now)
    facts.seaDay = { events: mine.map((e) => ({ id: e.id, title: e.title, startAt: e.startAt, endAt: e.endAt, placeId: e.placeId })) }
  }
  let goodNow: GoodNow | null = null
  if (mode === 'seaDay' && env) {
    const g = goodTime('lido-pool', pulseNow, env)
    if (g.label === 'quiet') goodNow = { now: g.now, at: g.at }
  }
  const subject = pos.date
  const ticked = new Set<string>()
  if (mode) for (const s of modeSteps(mode, facts)) if (isSeen(tickKey(mode, subject, s.id))) ticked.add(s.id)
  const view = mode ? modeView(modeSteps(mode, facts), ticked, now) : EMPTY
  return { mode, view, subject, zone, goodNow, tick: (step) => { if (mode) markSeen(tickKey(mode, subject, step)) } }
}
