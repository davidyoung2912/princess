import { useState } from 'react'
import { AWAY_GROUPS, awayList, awayText, cleanExtra, EXTRA_MAX, EXTRAS_MAX } from '../../domain/awayHome'
import { formatDate } from '../../domain/cruise'
import { dateIn } from '../../domain/timezones'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Share } from '../icons'
import { BackLink } from '../onboard/common'
import { OutOfOfficeCard } from '../delights/Delights'

/** Away-from-home checklist (S3-11): pets, mail, bills, work, medication and a home safety check. Ticks and own items stay on this device; the list can be sent as text. */
export function AwayScreen() {
  const sailing = useSailing()
  const today = dateIn(useNow(), 'America/New_York')
  const { state, update } = useMemory()
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const entries = awayList(sailing.departure, today, state.away)
  const label = (id: string) => t(`away.item.${id}` as StringKey)
  const done = entries.filter((e) => e.done).length + state.awayExtras.filter((x) => x.done).length
  const total = entries.length + state.awayExtras.length
  const tick = (id: string) => update((s) => ({ ...s, away: s.away.includes(id) ? s.away.filter((k) => k !== id) : [...s.away, id] }))
  const add = () => {
    const v = cleanExtra(text)
    if (!v || state.awayExtras.length >= EXTRAS_MAX) return
    update((s) => ({ ...s, awayExtras: [...s.awayExtras, { id: newMemoryId(), text: v, done: false }] }))
    setText('')
  }
  const share = async () => {
    const body = awayText(t('route.away'), entries, label, state.awayExtras)
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: t('route.away'), text: body })
      else { await navigator.clipboard.writeText(body); setNote(t('away.copied')) }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setNote(t('away.shareFailed'))
    }
  }
  return (
    <div className="page">
      <BackLink to="/plan" label={t('route.plan')} />
      <p>{t('away.intro', { date: formatDate(sailing.departure) })}</p>
      <p className="progress-line" role="status">{t('away.progress', { done, total })}</p>
      <progress className="meter" max={total} value={done} aria-label={t('away.progress', { done, total })} />
      <div className="button-row">
        <Button variant="secondary" onClick={() => void share()}><Share aria-hidden="true" /> {t('away.share')}</Button>
      </div>
      <p className="muted" role="status">{note}</p>
      {AWAY_GROUPS.map((g) => (
        <section key={g} aria-labelledby={`aw-${g}`}>
          <h2 id={`aw-${g}`}>{th(`away.group.${g}` as StringKey)}</h2>
          {entries.filter((e) => e.group === g).map((e) => (
            <div key={e.id} className="check-row">
              <input type="checkbox" id={`aw-i-${e.id}`} checked={e.done} onChange={() => tick(e.id)} />
              <div className="check-row__text">
                <label htmlFor={`aw-i-${e.id}`}><strong>{label(e.id)}</strong></label>
                <small>{t(`away.why.${e.id}` as StringKey)} {t('away.by', { date: formatDate(e.due) })}{e.late ? ` ${t('away.late')}` : ''}</small>
              </div>
            </div>
          ))}
        </section>
      ))}
      <Card labelledBy="aw-own">
        <h2 id="aw-own" className="card__title">{th('away.own')}</h2>
        {state.awayExtras.map((x) => (
          <div key={x.id} className="check-row">
            <input type="checkbox" id={`aw-x-${x.id}`} checked={x.done} onChange={() => update((s) => ({ ...s, awayExtras: s.awayExtras.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)) }))} />
            <div className="check-row__text"><label htmlFor={`aw-x-${x.id}`}><strong>{x.text}</strong></label></div>
            <Button variant="tertiary" onClick={() => update((s) => ({ ...s, awayExtras: s.awayExtras.filter((y) => y.id !== x.id) }))}>{t('away.remove')}<span className="visually-hidden"> {x.text}</span></Button>
          </div>
        ))}
        {state.awayExtras.length < EXTRAS_MAX && (
          <form onSubmit={(e) => { e.preventDefault(); add() }}>
            <Field label={t('away.add')} value={text} maxLength={EXTRA_MAX} onChange={(e) => setText(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={cleanExtra(text) === ''}>{t('away.addButton')}</Button>
          </form>
        )}
      </Card>
      <OutOfOfficeCard />
      <p className="muted">{t('away.note')}</p>
    </div>
  )
}
