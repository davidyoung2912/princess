import { useState, type FormEvent } from 'react'
import { MAX_PARTY_CABINS, QUIET_FROM } from '../../domain/services'
import { formatTime } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { AboardError } from './common'

/** Invite neighbours to a cabin party (ROM-06): up to six cabins, a quiet-hours limit and an answer from each. */
export function Parties() {
  const list = useMine(() => api.aboard.parties.list())
  const me = usePersona()
  const [title, setTitle] = useState('')
  const [day, setDay] = useState(2)
  const [time, setTime] = useState('18:00')
  const [cabins, setCabins] = useState('')
  const create = useAction(async () => {
    await api.aboard.parties.create({ title, day, time, cabins: cabins.split(/[\s,]+/).filter(Boolean) })
    setTitle('')
    setCabins('')
    list.retry()
  })
  const cancel = useAction(async (id: string) => { await api.aboard.parties.cancel(id); list.retry() })
  const submit = (e: FormEvent) => { e.preventDefault(); void create.run() }
  return (
    <section aria-labelledby="party-h">
      <h2 id="party-h">{t('party.title')}</h2>
      <p>{t('party.intro', { max: MAX_PARTY_CABINS, time: formatTime(QUIET_FROM) })}</p>
      <Load state={list}>
        {(parties) => (
          <>
            {parties.length > 0 && (
              <ul className="card-grid">
                {parties.map((p) => (
                  <li key={p.id}>
                    <Card>
                      <h3 className="card__title">{p.title}</h3>
                      <p className="muted">{t('ab.day', { day: p.day })}, {formatTime(p.time)}</p>
                      <ul className="plain-bullets">
                        {p.invited.map((i) => <li key={i.cabin}>{t('party.cabin', { cabin: i.cabin })} <StatusBadge kind={i.answer === 'yes' ? 'booked' : i.answer === 'maybe' ? 'waitlist' : 'cancelled'} label={t(`party.a.${i.answer}` as StringKey)} /></li>)}
                      </ul>
                      {!me?.child && <Button variant="tertiary" disabled={cancel.busy} onClick={() => void cancel.run(p.id)}>{t('party.cancel')}</Button>}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            {!me?.child && (
              <form onSubmit={submit}>
                <Field label={t('party.name')} value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} />
                <div className="field">
                  <label htmlFor="party-day">{t('ab.chooseDay')}</label>
                  <select id="party-day" className="field__input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{t('ab.day', { day: n })}</option>)}
                  </select>
                </div>
                <Field label={t('party.time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                <Field label={t('party.cabins')} hint={t('party.cabinsHint')} value={cabins} onChange={(e) => setCabins(e.target.value)} inputMode="numeric" />
                <AboardError error={create.error} />
                <Button type="submit" variant="secondary" disabled={create.busy || !title.trim() || !cabins.trim()}>{t('party.send')}</Button>
              </form>
            )}
            <AboardError error={cancel.error} />
          </>
        )}
      </Load>
    </section>
  )
}
