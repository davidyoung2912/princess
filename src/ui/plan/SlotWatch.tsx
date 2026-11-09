import { useState } from 'react'
import { bookWatch, newWatch, stopWatch, watchState, WATCH_KINDS, type Watch, type WatchKind, type WatchProblem } from '../../domain/autopilot'
import { formatMoney } from '../../domain/money'
import { useNow } from '../../hooks/useDemo'
import { useOpenings } from '../../hooks/useServedFeeds'
import { newPilotId, usePilot } from '../../hooks/usePilot'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { useConfirmCharge } from '../ConfirmCharge'
import { Field } from '../Field'
import { useShipTime } from '../onboard/shipTime'

const HOUR = 3_600_000
const AHEAD = [24, 48, 72] as const

/** Slot watch (S4-02): watch a full dinner, show or tour for a cancellation. The watch only ever ends in a proposal; the guest confirms the booking, and a swap keeps the current slot until the new one is booked. */
export function SlotWatch() {
  const { state, update } = usePilot()
  const now = useNow()
  const time = useShipTime()
  const openingOf = useOpenings(state.watches)
  const sure = useConfirmCharge()
  const [kind, setKind] = useState<WatchKind>('dinner')
  const [title, setTitle] = useState('')
  const [hours, setHours] = useState<number>(48)
  const [price, setPrice] = useState('0')
  const [cap, setCap] = useState('60')
  const [consent, setConsent] = useState(false)
  const [swap, setSwap] = useState('')
  const [problem, setProblem] = useState<WatchProblem | null>(null)

  const add = () => {
    const result = newWatch({ id: newPilotId(), kind, title, slotAt: now + hours * HOUR, priceCents: Math.round(Number(price) * 100) || 0, capCents: Math.round(Number(cap) * 100) || 0, consent, createdAt: now, current: swap.trim() ? { title: swap.trim().slice(0, 80), slotAt: now + (hours + 1) * HOUR } : null }, now)
    if (!result.ok) { setProblem(result.problem); return }
    setProblem(null)
    setTitle(''); setSwap('')
    update((s) => ({ ...s, watches: [...s.watches, result.watch] }))
  }
  const change = (id: string, next: (w: Watch) => Watch) => update((s) => ({ ...s, watches: s.watches.map((w) => (w.id === id ? next(w) : w)) }))
  const book = (w: Watch) => sure.ask(w.priceCents, w.title, () => {
    const r = bookWatch(w, now, openingOf(w))
    if (r.ok) change(w.id, () => r.watch)
  })

  return (
    <Card labelledBy="sw-h">
      <h2 id="sw-h" className="card__title">{th('watch.title')}</h2>
      <p>{t('watch.intro')}</p>
      <p className="muted">{t('watch.promise')}</p>
      <label htmlFor="sw-kind">{t('watch.kind')}</label>
      <select id="sw-kind" className="field__input" value={kind} onChange={(e) => setKind(e.target.value as WatchKind)}>{WATCH_KINDS.map((k) => <option key={k} value={k}>{t(`watch.kind.${k}` as StringKey)}</option>)}</select>
      <Field label={t('watch.what')} help={t('helptip.watchWhat')} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} error={problem === 'title' ? t('watch.err.title') : undefined} />
      <label htmlFor="sw-when">{t('watch.when')}</label>
      <select id="sw-when" className="field__input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>{AHEAD.map((h) => <option key={h} value={h}>{t('watch.inHours', { count: h })}</option>)}</select>
      <Field label={t('watch.price')} help={t('helptip.watchPrice')} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
      <Field label={t('watch.cap')} hint={t('watch.capHint')} type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} error={problem === 'cap' ? t('watch.err.cap') : problem === 'time' ? t('watch.err.time') : undefined} />
      <Field label={t('watch.swap')} hint={t('watch.swapHint')} value={swap} maxLength={80} onChange={(e) => setSwap(e.target.value)} />
      <label className="choice"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>{t('watch.consent')}</span></label>
      {problem === 'consent' && <p className="field__error" role="alert">{t('watch.err.consent')}</p>}
      <Button onClick={add}>{t('watch.add')}</Button>

      <ul className="plain-list">
        {state.watches.map((w) => {
          const st = watchState(w, now, openingOf(w))
          return (
            <li key={w.id}>
              <strong>{w.title}</strong> · {t(`watch.state.${st}` as StringKey)} · {t('watch.slot', { time: time(w.slotAt) })}
              {w.current && <span className="muted"> · {t('watch.keeping', { title: w.current.title })}</span>}
              {st === 'ready' && <p>{t('watch.ready', { price: formatMoney(w.priceCents) })}</p>}
              {st === 'overCap' && <p>{t('watch.overCap', { price: formatMoney(w.priceCents), cap: formatMoney(w.capCents) })}</p>}
              <div className="button-row">
                {st === 'ready' && <Button onClick={() => book(w)}>{t('watch.book')}</Button>}
                {(st === 'watching' || st === 'ready' || st === 'overCap') && <Button variant="secondary" onClick={() => change(w.id, stopWatch)}>{t('watch.stop')}</Button>}
              </div>
            </li>
          )
        })}
      </ul>
      {sure.dialog}
    </Card>
  )
}
