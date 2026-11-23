import { useCallback, useMemo, useRef, useState } from 'react'
import { keepCopy, keptSizes, readPackResult, shouldKeep, writePackResult } from '../data/capsule'
import { ALL_SECTIONS, estimateBytes, retryItems, runPack, selectItems, type PackChoice, type PackItem, type PackProgress, type PackResult } from '../data/cruisePack'
import { demoNow } from '../../features/demo/logic/store'
import { itinerary } from '../../domain/sailings'
import { api } from '../../app/runtime'
import { t, type StringKey } from '../i18n'
import { usePersona, useSailing } from './useDemo'
import { useOnline } from './useOnline'

/** The views the pack keeps, named exactly as the screens that read them name them (`useSavedCopy(kind, key, ...)`). */
export function packItems(me: { id: string; booker: string }, days: readonly { day: number; port: string }[]): PackItem[] {
  const b = me.booker
  const word = (key: StringKey, params?: Record<string, string | number>) => t(key, params)
  const one = (section: PackItem['section'], kind: string, key: string, label: string, load: () => Promise<unknown>, extra: Partial<PackItem> = {}): PackItem => ({ id: `${section}:${kind}:${key}`, section, kind, key, label, load, ...extra })
  return [
    one('essentials', 'pass', b, word('dl.item.pass'), () => api.boarding.pass()),
    one('essentials', 'muster', b, word('dl.item.muster'), () => api.onboard.muster()),
    one('essentials', 'emergency', me.id, word('dl.item.emergency'), () => api.onboard.emergency()),
    one('essentials', 'embark', b, word('dl.item.embark'), () => api.boarding.embark()),
    one('essentials', 'receipt', b, word('dl.item.receipt'), () => api.checkin.receipt()),
    one('essentials', 'health', me.id, word('dl.item.health'), () => api.health.view()),
    one('reservations', 'dining', b, word('dl.item.dining'), () => api.plan.dining.view()),
    one('reservations', 'spa', b, word('dl.item.spa'), () => api.plan.spa.view()),
    one('reservations', 'room', b, word('dl.item.room'), () => api.room.view()),
    one('reservations', 'family', b, word('dl.item.family'), () => api.family.view()),
    ...days.map((d) => one('programme', 'program', `${me.id}:${d.day}`, word('dl.item.program', { day: d.day }), () => api.onboard.program(d.day), { day: d.day })),
    ...days.filter((d) => d.port !== 'sea').map((d) => one('tours', 'explorer', `${me.id}:tours:${d.day}`, word('dl.item.tours', { day: d.day }), () => api.onboard.dayTours(d.day), { day: d.day, port: d.port })),
    one('bill', 'folio', b, word('dl.item.folio'), () => api.onboard.folio()),
    one('home', 'disembark', b, word('dl.item.disembark'), () => api.disembark.view()),
    one('home', 'customs', b, word('dl.item.customs'), () => api.disembark.customs()),
    one('home', 'night', b, word('dl.item.night'), () => api.disembark.night()),
    one('home', 'onward', b, word('dl.item.onward'), () => api.disembark.onward()),
  ]
}

/** "Download my cruise": choose, see an estimate, download with progress, and try the failed items again. Needs a connection; says so when there is none. */
export function useCruisePack() {
  const me = usePersona()
  const sailing = useSailing()
  const online = useOnline()
  const [choice, setChoice] = useState<PackChoice>(ALL_SECTIONS)
  const [progress, setProgress] = useState<PackProgress | null>(null)
  const [result, setResult] = useState<PackResult | null>(readPackResult)
  const cancel = useRef({ cancelled: false })
  const days = useMemo(() => itinerary(sailing).map((d) => ({ day: d.day, port: d.port as string })), [sailing])
  const all = useMemo(() => (me ? packItems({ id: me.id, booker: me.booker }, days) : []), [me, days])
  // A kind the guest switched off in the saved-copy list is not downloaded.
  const wanted = useMemo(() => selectItems(all, choice).filter((i) => shouldKeep(i.kind)), [all, choice])
  const estimate = useMemo(() => estimateBytes(wanted, keptSizes()), [wanted])
  const ports = useMemo(() => [...new Set(all.filter((i) => i.port).map((i) => i.port as string))], [all])

  const run = useCallback(async (items: readonly PackItem[]) => {
    cancel.current = { cancelled: false }
    const r = await runPack(items, { put: (i, v, at) => keepCopy(i.kind, i.key, v, at) }, { now: demoNow, onProgress: setProgress, signal: cancel.current })
    setProgress(null)
    // A retry adds to the last result: what was kept before stays kept.
    const merged: PackResult = items.length < wanted.length && result
      ? { at: r.at, total: wanted.length, bytes: result.bytes + r.bytes, done: [...new Set([...result.done, ...r.done])], failed: r.failed.concat(result.failed.filter((f) => !items.some((i) => i.id === f.id))) }
      : r
    writePackResult(merged)
    setResult(merged)
  }, [wanted.length, result])

  return {
    ready: !!me && all.length > 0,
    online,
    choice, setChoice, ports, wanted, estimate, progress, result,
    running: progress !== null,
    start: () => run(wanted),
    retry: () => run(retryItems(wanted, result)),
    stop: () => { cancel.current.cancelled = true },
  }
}
