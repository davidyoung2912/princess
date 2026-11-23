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
  const restart = useCallback((next: S) => { setState(next); setHistory([]) }, [])
  return { state, commit, undo, restart, moves: history.length, canUndo: history.length > 0 }
}
