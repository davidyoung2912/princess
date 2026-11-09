import { useEffect, useRef } from 'react'
import { ignoreKey, nextChord, type Shortcut } from '../domain/ease'

const CHORD_MS = 2000

/** Listens for the desktop shortcuts and calls `run` with the one pressed. Ignores typing in fields and keys with Ctrl, Alt or Command held. A "g" waiting for its second key lapses after two seconds. */
export function useShortcuts(run: (s: Shortcut) => void) {
  const waitingSince = useRef<number | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key.length > 1 || ignoreKey({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, target: e.target as HTMLElement | null })) return
      const waiting = waitingSince.current !== null && e.timeStamp - waitingSince.current < CHORD_MS
      const next = nextChord(waiting, e.key)
      waitingSince.current = next.pending ? e.timeStamp : null
      if (next.shortcut) { e.preventDefault(); run(next.shortcut) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run])
}
