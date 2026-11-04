import { normalizeDay, type ServedDay } from './dayPlan'
import { createFeed, isInt, isRecord } from './feed'
import { MAX_PLAN_DAY } from '../domain/nightsRules'

/** One day the visitor can pick: its number, the port id (`sea` for a day at sea) and the place's name as the server writes it. */
export interface TrialChoice { day: number; port: string; place: string }

/** The days to choose from and the plan for the one asked for (`POST /public/trial-day`, no sign-in). */
export interface TrialDay { days: TrialChoice[]; plan: ServedDay }

/** Reads the server's answer. Anything wrong gives null. */
export function normalizeTrialDay(raw: unknown): TrialDay | null {
  if (!isRecord(raw) || !Array.isArray(raw.days) || raw.days.length < 1 || raw.days.length > MAX_PLAN_DAY) return null
  const days: TrialChoice[] = []
  for (const d of raw.days) {
    if (!isRecord(d) || !isInt(d.day, 1, MAX_PLAN_DAY) || typeof d.port !== 'string' || d.port.length === 0 || d.port.length > 20 || typeof d.place !== 'string' || d.place.length === 0 || d.place.length > 80) return null
    days.push({ day: d.day, port: d.port, place: d.place })
  }
  const plan = normalizeDay(raw.plan)
  return plan ? { days, plan } : null
}

/** A day for a visitor, from a day number and wishes (see `wishKey`). Not kept on the device: nothing here belongs to a person. */
export const trialDayFeed = createFeed<[day: number, wishes: string], TrialDay>((d, w) => `${d}|${w}`, normalizeTrialDay)

/** A port day is one with a tour to pick; a day at sea or on the first or last day (in the home port) has events and dinner only. */
export const hasTours = (c: TrialChoice | undefined, days: readonly TrialChoice[] = []): boolean =>
  !!c && c.port !== 'sea' && c.day !== days[0]?.day && c.day !== days[days.length - 1]?.day
