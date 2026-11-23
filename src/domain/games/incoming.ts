/** A puzzle handed from a chat card to a game screen (docs/chat-bundles-plan.md, phase B8). Held in memory only, never in an address, and for a short time, so a stale one can never start a game later. */
import type { ShareMode, SharedGame } from './share'

export interface Incoming { game: string; shared: SharedGame; mode: ShareMode; at: number; /** Seconds to beat, from a result. */ target?: number }

/** How long a held puzzle waits for the screen to open. */
export const INCOMING_LIFE_MS = 30_000

let held: Incoming | null = null

export function holdIncoming(game: string, shared: SharedGame, mode: ShareMode, now = Date.now(), target?: number): void {
  held = { game, shared, mode, at: now, ...(target ? { target } : {}) }
}

/** The time to beat for the puzzle held, or undefined. */
export const heldTarget = (): number | undefined => held?.target

/** The puzzle held for this game, or null (none, another game's, or too old). It stays until `clearIncoming` so a screen that renders twice sees the same one. */
export function peekIncoming(game: string, now = Date.now()): Incoming | null {
  return held && held.game === game && now - held.at <= INCOMING_LIFE_MS ? held : null
}

export function clearIncoming(): void { held = null }
