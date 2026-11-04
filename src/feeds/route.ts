import type { Conditions, Crowd } from '../domain/journey'
import { createFeed } from './feed'

const TRAFFIC = ['light', 'moderate', 'heavy'] as const
const SKY = ['clear', 'cloudy', 'rain', 'storm'] as const

/** Reads the server's answer; anything wrong in it gives null. */
export function normalizeConditions(raw: unknown): Conditions | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!(TRAFFIC as readonly unknown[]).includes(r.traffic) || !(SKY as readonly unknown[]).includes(r.sky)) return null
  const mins = typeof r.leaveEarlierMinutes === 'number' && Number.isFinite(r.leaveEarlierMinutes) ? Math.max(0, Math.round(r.leaveEarlierMinutes)) : 0
  return { traffic: r.traffic as Conditions['traffic'], sky: r.sky as Conditions['sky'], leaveEarlierMinutes: mins }
}

/** Traffic and weather on the way to the port, by id and the crowd for the arrival window. */
export const conditionsFeed = createFeed<[sailing: string, crowd: Crowd], Conditions>((d, c) => `${d}|${c}`, normalizeConditions, 'route')
