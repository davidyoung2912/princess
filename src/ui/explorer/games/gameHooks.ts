import { useEffect, useState } from 'react'
import { startVisibleInterval } from '../../../hooks/visibleInterval'
import { clearIncoming, noteElapsed, peekIncoming } from '../../../domain/games/incoming'
import { startOnly, type ShareMode, type SharedGame } from '../../../domain/games/share'

/** A clock that counts seconds while `running` and the page is showing. `reset` starts it again from 0:00. */
export function useGameClock(running: boolean): { seconds: number; reset: () => void } {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => (running ? startVisibleInterval(() => setSeconds((s) => s + 1), 1000) : undefined), [running])
  useEffect(() => noteElapsed(seconds), [seconds])
  return { seconds, reset: () => setSeconds(0) }
}

/**
 * The puzzle a chat card handed to this game (docs/chat-bundles-plan.md, B8), read once when the screen opens and forgotten when it closes. `shared` is already the clues alone when the
 * sender chose the starting position, and `fresh` ends the "from a chat" note when the player moves on to a puzzle of their own.
 */
export function useIncomingGame(game: string): { incoming: { shared: SharedGame; mode: ShareMode } | null; fromChat: ShareMode | null; leaveChat: () => void } {
  const [incoming] = useState(() => { const held = peekIncoming(game); return held ? { shared: held.mode === 'start' ? startOnly(held.shared) : held.shared, mode: held.mode } : null })
  const [fromChat, setFromChat] = useState<ShareMode | null>(incoming?.mode ?? null)
  useEffect(() => () => clearIncoming(), [])
  return { incoming, fromChat, leaveChat: () => { clearIncoming(); setFromChat(null) } }
}
