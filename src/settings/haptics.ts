import type { Settings } from './settings'

/** A short buzz for a tick or a moment (docs/experience-extension-ideas.md 4.5.1). Android only: iOS Safari has no `navigator.vibrate`. */
export const BUZZ = { tick: 30, moment: [40, 60, 40] as number[], last: 60 } as const

/** True when a buzz is welcome: never in calm mode, with reduced motion (the setting or the device), or where the device cannot vibrate. */
export const mayVibrate = (s: Pick<Settings, 'calm' | 'reduceMotion'>, deviceReducesMotion: boolean, canVibrate: boolean): boolean =>
  canVibrate && !s.calm && !s.reduceMotion && !deviceReducesMotion

/** Buzzes if the settings and the device allow it; otherwise does nothing. Returns whether it buzzed. */
export function buzz(s: Pick<Settings, 'calm' | 'reduceMotion'>, pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined') return false
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!mayVibrate(s, reduced, typeof navigator.vibrate === 'function')) return false
  return navigator.vibrate(pattern)
}
