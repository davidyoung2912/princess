import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { asDayTours, asExplorerDay, asVenueDay } from '../api/guards'
import type { DayTour } from '../api/types'
import type { ExplorerDay, VenueDay } from '../api/explorerTypes'
import { REMINDER_DEFAULT } from '../domain/notifications'
import { dayChoices, resolveExplorerDay, stepDay, type DayChoice } from '../domain/explorer/explorerDay'
import type { ExplorerKind } from '../domain/explorer/types'
import { itinerary, shipZoneAt } from '../domain/sailings'
import { timeIn } from '../domain/timezones'
import { api } from '../runtime'
import { useCurrentDay } from './useDayPlan'
import { useNow, usePersona, useSailing } from './useDemo'
import { useSavedCopy, type SavedCopy } from './useSavedCopy'

/** The day the guest last chose, kept while the app is open so it carries from one Explorer to the next. The address (`?day=N`) wins when it has one. */
let remembered: number | null = null

/** Forgets the chosen day (tests, and a sign-out). */
export function resetExplorerDay(): void { remembered = null }

export interface ExplorerDayState {
  day: number
  total: number
  /** The ship's own day now. */
  currentDay: number
  choices: DayChoice[]
  /** Ship time "HH:MM" now. */
  now: string
  nowAt: number
  setDay: (n: number) => void
  step: (delta: number) => void
  today: () => void
}

/** The cruise day an Explorer shows: from `?day=`, else the one chosen earlier this session, else the ship's day. */
export function useExplorerDay(): ExplorerDayState {
  const sailing = useSailing()
  const days = itinerary(sailing)
  const total = days.length
  const currentDay = useCurrentDay()
  const nowAt = useNow()
  const [params, setParams] = useSearchParams()
  const day = resolveExplorerDay({ requested: params.get('day'), remembered, currentDay, total })
  useEffect(() => { remembered = day }, [day])
  const setDay = useCallback((n: number) => {
    remembered = n
    setParams((p) => { const next = new URLSearchParams(p); next.set('day', String(n)); return next }, { replace: true })
  }, [setParams])
  return {
    day, total, currentDay, choices: dayChoices(days, currentDay), now: timeIn(nowAt, shipZoneAt(sailing, nowAt)), nowAt, setDay,
    step: (delta) => setDay(stepDay(day, delta, total)), today: () => setDay(Math.min(Math.max(currentDay, 1), total)),
  }
}

/** One Explorer on one day, with a copy kept for offline use. */
export function useExplorerData(kind: ExplorerKind, day: number): SavedCopy<ExplorerDay> {
  const me = usePersona()
  return useSavedCopy('explorer', `${me?.id ?? 'none'}:${kind}:${day}`, () => api.onboard.explorerDay(kind, day), asExplorerDay, [me?.id])
}

/** One venue on one day, with a copy kept for offline use. */
export function useVenueData(kind: ExplorerKind, venueId: string, day: number): SavedCopy<VenueDay> {
  const me = usePersona()
  return useSavedCopy('explorer', `${me?.id ?? 'none'}:${kind}:${venueId}:${day}`, () => api.onboard.explorerVenue(kind, venueId, day), asVenueDay, [me?.id])
}

/** The shore excursions the guest has booked on one cruise day, with a copy kept for offline use. */
export function useDayTours(day: number): SavedCopy<DayTour[]> {
  const me = usePersona()
  return useSavedCopy('explorer', `${me?.id ?? 'none'}:tours:${day}`, () => api.onboard.dayTours(day), asDayTours, [me?.id])
}

export interface PlanState {
  planned: ReadonlySet<string>
  busy: boolean
  failed: boolean
  /** The words for a screen reader after the last change. */
  announcement: string
  toggle: (eventId: string, title: string, on: boolean) => Promise<void>
  /** The reminder chosen for a planned event (minutes, 0 off), or undefined when it follows the notification preference. */
  reminders: Readonly<Record<string, number>>
  setReminder: (eventId: string, lead: number) => Promise<void>
}

/** The events planned for a day, starting from what the server said and following each change. */
export function usePlan(day: number, served: readonly string[], servedReminders: Readonly<Record<string, number>> | undefined, words: { added: (title: string) => string; removed: (title: string) => string }): PlanState {
  const [override, setOverride] = useState<{ day: number; base: readonly string[]; list: readonly string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [chosen, setChosen] = useState<{ day: number; base: unknown; map: Record<string, number> } | null>(null)
  const current = override && override.day === day && override.base === served ? override.list : served
  const toggle = useCallback(async (eventId: string, title: string, on: boolean) => {
    setBusy(true)
    setFailed(false)
    try {
      setOverride({ day, base: served, list: await api.onboard.togglePlanOn(eventId, day, on) })
      setAnnouncement(on ? words.added(title) : words.removed(title))
    } catch { setFailed(true) } finally { setBusy(false) }
  }, [day, served, words])
  const reminders = chosen && chosen.day === day && chosen.base === servedReminders ? chosen.map : servedReminders ?? {}
  const remindersRef = useRef(reminders)
  useEffect(() => { remindersRef.current = reminders })
  const setReminder = useCallback(async (eventId: string, lead: number) => {
    setBusy(true)
    setFailed(false)
    try {
      setOverride({ day, base: served, list: await api.onboard.setPlanReminder(eventId, day, lead) })
      const next = { ...remindersRef.current }
      if (lead === REMINDER_DEFAULT) delete next[eventId]; else next[eventId] = lead
      setChosen({ day, base: servedReminders, map: next })
    } catch { setFailed(true) } finally { setBusy(false) }
  }, [day, served, servedReminders])
  return { planned: new Set(current), busy, failed, announcement, toggle, reminders, setReminder }
}
