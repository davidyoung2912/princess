import type { Capsule, StorageState } from './offlineCapsule'

/**
 * Readiness before sailing (GTS-15, MOB-24): a night-before test that says plainly whether this phone is set up for a day with no signal,
 * and how often a phone on a low battery should ask for fresh data. Framework-free; the screen reads the phone and passes the facts in.
 */
export type CheckId = 'essentials' | 'fresh' | 'storage' | 'notifications' | 'battery'
export type CheckResult = 'pass' | 'warn' | 'fail'

export interface ReadinessFacts {
  capsule: Capsule
  storage: StorageState
  /** 'granted', 'denied', 'default' or null when the browser has no notifications. */
  notifications: 'granted' | 'denied' | 'default' | null
  /** Battery level 0 to 1 and whether it is charging; null when the browser does not say. */
  battery: { level: number; charging: boolean } | null
}

export interface ReadinessCheck { id: CheckId; result: CheckResult }

export interface ReadinessReport { checks: ReadinessCheck[]; result: CheckResult }

/** A battery at or under this share counts as low when not charging. */
export const LOW_BATTERY = 0.2

export const batteryIsLow = (b: ReadinessFacts['battery']): boolean => b !== null && !b.charging && b.level <= LOW_BATTERY

/** Runs the checks. The overall result is the worst single one: any fail is a fail, otherwise any warning is a warning. */
export function nightBeforeTest(f: ReadinessFacts): ReadinessReport {
  const ageing = f.capsule.rows.some((r) => r.essential && r.state === 'ageing')
  const checks: ReadinessCheck[] = [
    { id: 'essentials', result: f.capsule.readiness === 'ready' ? 'pass' : f.capsule.readiness === 'partial' ? 'warn' : 'fail' },
    { id: 'fresh', result: f.capsule.readiness === 'empty' ? 'fail' : ageing ? 'warn' : 'pass' },
    { id: 'storage', result: f.storage === 'protected' ? 'pass' : f.storage === 'low' ? 'fail' : 'warn' },
    { id: 'notifications', result: f.notifications === 'granted' ? 'pass' : 'warn' },
    { id: 'battery', result: batteryIsLow(f.battery) ? 'warn' : 'pass' },
  ]
  const result: CheckResult = checks.some((c) => c.result === 'fail') ? 'fail' : checks.some((c) => c.result === 'warn') ? 'warn' : 'pass'
  return { checks, result }
}

/**
 * How many times longer to wait between refreshes (MOB-24). Data-light asks for a quarter as often; a low battery that is not charging
 * asks for half as often; both together multiply. Never less than 1.
 */
export function refreshFactor(o: { dataLight: boolean; battery: ReadinessFacts['battery'] }): number {
  return (o.dataLight ? 4 : 1) * (batteryIsLow(o.battery) ? 2 : 1)
}
