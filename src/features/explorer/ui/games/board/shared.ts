import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Skill } from '../../../../games/domain/search'
import { t, type StringKey } from '../../../../../shared/i18n'

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
