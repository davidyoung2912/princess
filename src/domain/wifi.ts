import type { Cents } from './pricing'

/** Ship Wi-Fi (NET-02): plans, devices, a usage meter and sign-in help. The app itself never needs a paid plan (NET-01). Plans and prices are authored concept values. */
export type WifiPlan = 'messaging' | 'surf' | 'stream'

export interface PlanDef { id: WifiPlan; perDay: Cents; /** Megabytes per device per day; null means no limit. */ capMb: number | null; rank: number }

export const PLANS: readonly PlanDef[] = [
  { id: 'messaging', perDay: 999, capMb: 500, rank: 1 },
  { id: 'surf', perDay: 1999, capMb: 3000, rank: 2 },
  { id: 'stream', perDay: 2999, capMb: null, rank: 3 },
]

export const planById = (id: unknown): PlanDef | undefined => PLANS.find((p) => p.id === id)

export const MAX_DEVICES = 6
export const MAX_DAYS = 8
/** The plan a package or tier gives for free. */
export const INCLUDED_PLAN: WifiPlan = 'surf'

export interface StoredDevice { id: string; name: string; plan: WifiPlan; addedAt: number; days: number; included: boolean; paid: Cents }

const DAY = 86_400_000

export const expiresAt = (d: Pick<StoredDevice, 'addedAt' | 'days'>): number => d.addedAt + d.days * DAY

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Megabytes used today: a steady rate for the device, from the start of its current ship day. */
export function usedTodayMb(d: Pick<StoredDevice, 'id' | 'addedAt'>, now: number): number {
  const rate = 0.4 + (hash(d.id) % 25) / 10
  const since = Math.min(now - d.addedAt, now % DAY)
  return Math.max(0, Math.round((since / 60_000) * rate))
}

export type WifiProblem = 'badName' | 'duplicate' | 'tooMany' | 'badPlan' | 'badDays' | 'notAnUpgrade' | 'expired'

export function addProblem(name: unknown, plan: unknown, days: unknown, existing: readonly Pick<StoredDevice, 'name'>[]): WifiProblem | null {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 30) return 'badName'
  if (existing.some((d) => d.name.toLowerCase() === name.trim().toLowerCase())) return 'duplicate'
  if (existing.length >= MAX_DEVICES) return 'tooMany'
  if (!planById(plan)) return 'badPlan'
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) return 'badDays'
  return null
}

/** Days left on a plan, rounded up, at least one. */
export const daysLeft = (d: StoredDevice, now: number): number => Math.max(1, Math.ceil((expiresAt(d) - now) / DAY))

export const upgradeCost = (d: StoredDevice, to: PlanDef, now: number): Cents => Math.max(0, to.perDay - (planById(d.plan)?.perDay ?? 0)) * daysLeft(d, now)
