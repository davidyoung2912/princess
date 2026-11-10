import { useEffect, useState } from 'react'
import { normalizeCases } from '../ai/stanleyHandoff'
import { openFromCases, openFromHandoffs, rebookGate, mayPromoteRebooking, type RebookGate } from '../ai/stanleyRemember'
import { api, stanleyHandoffs } from '../runtime'
import { useNow } from './useDemo'

/** The ship's cases and Stanley's hand-offs the guest still has open, read once. A failed read counts as "do not promote": nothing is suggested when the answer could not be checked. */
export function useRebookGate(): RebookGate | null {
  const now = useNow()
  const [gate, setGate] = useState<RebookGate | null>(null)
  useEffect(() => {
    let live = true
    void Promise.allSettled([stanleyHandoffs.list(), api.cases.list()]).then(([h, c]) => {
      if (!live) return
      if (h.status === 'rejected' && c.status === 'rejected') { setGate({ mode: 'soften', cases: [] }); return }
      const handoffs = h.status === 'fulfilled' ? openFromHandoffs(normalizeCases(h.value), now) : []
      const cases = c.status === 'fulfilled' ? openFromCases(c.value.cases) : []
      setGate(rebookGate([...handoffs, ...cases]))
    })
    return () => { live = false }
  }, [now])
  return gate
}

/** Whether a prompt to book again may be shown now; false while the gate is unknown or any case is open. */
export const usePromoteRebooking = (): boolean => { const g = useRebookGate(); return g !== null && mayPromoteRebooking(g) }

