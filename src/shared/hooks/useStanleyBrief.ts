import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeBrief, normalizeBriefState, type Brief, type BriefKind, type BriefSettings, type BriefState } from '../../features/stanley/logic/stanleyBrief'
import { stanleyBrief } from '../../app/runtime'

/** The guest's brief choices as the server holds them (phase P7), and a preview of either brief. Nothing is kept on this device. */
export function useStanleyBrief() {
  const [state, setState] = useState<BriefState | null>(null)
  const [preview, setPreview] = useState<Brief | null | 'none'>(null)
  const [failed, setFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    void stanleyBrief.get().then(
      (raw) => { if (live.current) { const s = normalizeBriefState(raw); setState(s); setFailed(s === null); setBusy(false) } },
      () => { if (live.current) { setFailed(true); setBusy(false) } },
    )
    return () => { live.current = false }
  }, [])

  const save = useCallback(async (change: Partial<BriefSettings>) => {
    setBusy(true); setSaveFailed(false)
    try {
      const s = normalizeBriefState(await stanleyBrief.put(change))
      if (live.current && s) setState(s)
      else if (live.current) setSaveFailed(true)
    } catch { if (live.current) setSaveFailed(true) }
    if (live.current) setBusy(false)
  }, [])

  const show = useCallback(async (kind: BriefKind) => {
    try {
      const raw = await stanleyBrief.preview(kind)
      if (live.current) setPreview(raw ? (normalizeBrief(raw) ?? 'none') : 'none')
    } catch { if (live.current) setPreview('none') }
  }, [])

  return { state, preview, failed, saveFailed, busy, save, show }
}
