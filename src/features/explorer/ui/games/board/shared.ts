import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Skill } from '../../../../games/domain/search'
import { t, type StringKey } from '../../../../../shared/i18n'
import { addResult, readPref, writePref, type Outcome } from '../../../../../shared/settings/gamePrefs'

/** How long the computer "thinks" before it moves, by strength: the stronger the opponent, the longer it appears to take. */
export const THINK_MS: Record<Skill, number> = { cadet: 450, captain: 800, admiral: 1300 }

/** Runs `act` once after the thinking pause whenever `active` is true; `key` changes with every position so each computer move gets its own pause. */
export function useComputerTurn(active: boolean, skill: Skill, key: unknown, act: () => void): void {
  const ref = useRef(act)
  useEffect(() => { ref.current = act })
  useEffect(() => {
    if (!active) return undefined
    const id = window.setTimeout(() => ref.current(), THINK_MS[skill])
    return () => window.clearTimeout(id)
  }, [active, skill, key])
}

export const SKILL_KEYS: Record<Skill, StringKey> = { cadet: 'bd.skill.cadet', captain: 'bd.skill.captain', admiral: 'bd.skill.admiral' }

export const skillName = (s: Skill): string => t(SKILL_KEYS[s])

/** One tab stop for a whole board: arrow keys move between the points, Enter or Space picks. `cols` is the row length. */
export function useRoving(cols: number, count: number, onPick: (i: number) => void) {
  const [cursor, setCursor] = useState(0)
  const root = useRef<SVGSVGElement | null>(null)
  const go = (i: number) => { setCursor(i); window.requestAnimationFrame(() => root.current?.querySelector<SVGElement>(`[data-i="${i}"]`)?.focus()) }
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const r = Math.floor(i / cols), c = i % cols
    const next: Record<string, number> = { ArrowLeft: c > 0 ? i - 1 : i, ArrowRight: c < cols - 1 && i + 1 < count ? i + 1 : i, ArrowUp: r > 0 ? i - cols : i, ArrowDown: i + cols < count ? i + cols : i }
    if (e.key in next) { e.preventDefault(); go(next[e.key]) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i) }
  }
  const props = (i: number) => ({ 'data-i': i, role: 'button' as const, tabIndex: i === cursor ? 0 : -1, onFocus: () => setCursor(i), onKeyDown: (e: KeyboardEvent) => onKeyDown(e, i) })
  return { root, props }
}

/** A choice that is remembered on this device between visits (the opponent, the board size, the side), falling back to `fallback` when nothing valid is saved. */
export function usePref<T extends string>(game: string, name: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => readPref(game, name, allowed, fallback))
  const set = (v: T) => { setValue(v); writePref(game, name, v) }
  return [value, set]
}

/** Who moves first: you, or the computer. The same pair of words in every game against the computer. */
export type Opening = 'you' | 'computer'
export const OPENINGS: readonly Opening[] = ['you', 'computer']

/** The move the computer would suggest, kept only while the position it was worked out for is still on the board, and how many hints this game has used. */
export function useHint<S, H>() {
  const [h, setH] = useState<{ at: S; v: H } | null>(null)
  const [used, setUsed] = useState(0)
  return { of: (g: S): H | null => (h && h.at === g ? h.v : null), give: (g: S, v: H) => { setH({ at: g, v }); setUsed((u) => u + 1) }, used, reset: () => { setH(null); setUsed(0) } }
}

/** A seed that is the same for everyone on the same day, so a "today's puzzle" is shared by the whole ship. `salt` makes each level or size its own puzzle. */
export const dailySeed = (salt: number, now: Date = new Date()): number => now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate() + salt * 7919

/** Saves a finished solo game once (when `outcome` appears) and says how many you have won and your best score, on this device only. */
export function useSoloRecord(game: string, key: string, outcome: Outcome | null, score: number): void {
  useEffect(() => { if (outcome) addResult(game, key, outcome, score) }, [game, key, outcome, score])
}
