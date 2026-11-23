import { useCallback, useState } from 'react'

/** The state of a card game with Undo: every change is pushed on a stack, and Undo pops it. */
export function useCardGame<S>(make: () => S) {
  const [state, setState] = useState<S>(make)
  const [history, setHistory] = useState<S[]>([])
  const commit = useCallback((next: S) => {
    setState((cur) => {
      if (next === cur) return cur
      setHistory((h) => [...h, cur])
      return next
    })
  }, [])
  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      setState(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [])
  /** Undo back to the latest earlier position that satisfies `ok` (the player's own turn), so one tap takes back the computer's reply too. */
  const undoUntil = useCallback((ok: (s: S) => boolean) => {
    setHistory((h) => {
      if (h.length === 0) return h
      let i = h.length - 1
      while (i >= 0 && !ok(h[i])) i--
      if (i < 0) { setState(h[0]); return [] }
      setState(h[i])
      return h.slice(0, i)
    })
  }, [])
  const restart = useCallback((next: S) => { setState(next); setHistory([]) }, [])
  return { state, commit, undo, undoUntil, restart, moves: history.length, canUndo: history.length > 0 }
}
