import { useState } from 'react'
import { formatTime } from '../../domain/cruise'
import { excursionById } from '../../domain/excursions'
import { formatMoney } from '../../domain/pricing'
import { PORT_CONTACTS, readyFor, readyText } from '../../domain/services'
import type { PersonaId } from '../../domain/personas'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { AboardError } from './common'

type Contactable = keyof typeof PORT_CONTACTS

/** Last-minute tours that can still be booked on board today, with the seats left (POR-05). */
export function LastMinute() {
  const view = useMine(() => api.aboard.lastMinute.list())
  const me = usePersona()
  const [who, setWho] = useState<PersonaId[]>(me ? [me.id] : [])
  const book = useAction(async (id: string) => { await api.aboard.lastMinute.book(id, who); view.retry() })
  return (
    <section aria-labelledby="lm-h">
      <h2 id="lm-h">{t('lm.title')}</h2>
      <Load state={view}>
        {(v) => {
          if (v.port === null) return <p className="muted">{t('lm.none')}</p>
          const people = v.guests.filter((g) => g.id === me?.id || !me?.child)
          return (
            <>
              <p>{t('lm.intro')}</p>
              <fieldset className="plain-fieldset">
                <legend>{t('lm.who')}</legend>
                {people.map((g) => (
                  <label key={g.id} className="choice">
                    <input type="checkbox" checked={who.includes(g.id)} onChange={(e) => setWho(e.target.checked ? [...who, g.id] : who.filter((x) => x !== g.id))} />
                    <span>{g.name}</span>
                  </label>
                ))}
              </fieldset>
              <AboardError error={book.error} />
              <ul className="card-grid">
                {v.tours.map((x) => {
                  const tour = excursionById(x.excursionId)!
                  return (
                    <li key={x.excursionId}>
                      <Card>
                        <h3 className="card__title">{tour.name}</h3>
                        <p>{tour.summary}</p>
                        <p className="muted">{t('lm.starts', { time: formatTime(x.start) })} · {formatMoney(x.price)} · {x.left === 0 ? t('lm.soldOut') : x.left <= 8 ? t('lm.fewLeft', { count: x.left }) : t('lm.left', { count: x.left })}</p>
                        {x.closed ? <p><StatusBadge kind={x.closed === 'booked' ? 'booked' : 'soldOut'} label={t(`lm.c.${x.closed}` as StringKey)} /></p> : (
                          <Button variant="secondary" disabled={book.busy || who.length === 0 || !!me?.child} onClick={() => void book.run(x.excursionId)}>{t('lm.book')}</Button>
                        )}
                      </Card>
                    </li>
                  )
                })}
              </ul>
              <p className="muted">{t('lm.note')}</p>
            </>
          )
        }}
      </Load>
    </section>
  )
}

/** Who to call ashore (POR-07): the consulate, the local emergency number and the ship's agent. */
export function ContactsAshore({ port }: { port: Contactable }) {
  const c = PORT_CONTACTS[port]
  return (
    <Card labelledBy="ashore-h">
      <h2 id="ashore-h" className="card__title">{t('ashore.title')}</h2>
      <dl className="plain-dl">
        <div><dt>{t('ashore.emergency')}</dt><dd>{c.emergency}</dd></div>
        <div><dt>{t('ashore.agent')}</dt><dd>{c.agent}</dd></div>
        <div><dt>{t('ashore.consulate')}</dt><dd>{c.consulate}</dd></div>
      </dl>
      <p className="muted">{t('ashore.note')}</p>
    </Card>
  )
}

/** A checklist for the port day, with one tap to share it (POR-13). */
export function Readiness({ tender }: { tender: boolean }) {
  const ticked = useMine(() => api.aboard.ready.get())
  const tick = useAction(async (id: string, on: boolean) => { await api.aboard.ready.set(id, on); ticked.retry() })
  const [note, setNote] = useState('')
  const items = readyFor(tender)
  const share = async () => {
    const text = readyText(t('ready.title'), items.map((i) => ({ label: t(`ready.i.${i.id}` as StringKey), done: (ticked.data ?? []).includes(i.id) })))
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: t('ready.title'), text })
      else { await navigator.clipboard.writeText(text); setNote(t('ready.copied')) }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNote(t('ready.failed'))
    }
  }
  return (
    <Card labelledBy="ready-h">
      <h2 id="ready-h" className="card__title">{t('ready.title')}</h2>
      <Load state={ticked}>
        {(ids) => (
          <>
            <ul className="checklist">
              {items.map((i) => (
                <li key={i.id}>
                  <label className="choice">
                    <input type="checkbox" checked={ids.includes(i.id)} disabled={tick.busy} onChange={(e) => void tick.run(i.id, e.target.checked)} />
                    <span>{t(`ready.i.${i.id}` as StringKey)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p role="status">{ids.length === items.length ? <Banner kind="success" title={t('ready.done')} /> : t('ready.count', { done: ids.filter((x) => items.some((i) => i.id === x)).length, total: items.length })}</p>
          </>
        )}
      </Load>
      <AboardError error={tick.error} />
      <Button variant="secondary" onClick={() => void share()}>{t('ready.share')}</Button>
      <p role="status" className="muted">{note}</p>
    </Card>
  )
}
