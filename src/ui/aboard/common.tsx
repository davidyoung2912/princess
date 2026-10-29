import { useState } from 'react'
import { Link } from 'react-router'
import type { ApiError } from '../../api/errors'
import { chargeFor, endTime, itemById, placesLeft, type Item, type Selection } from '../../domain/catalogue'
import { formatTime } from '../../domain/cruise'
import { placeById } from '../../domain/deck'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { ActionError, Load, SupervisedNote } from '../account/parts'
import { personaById } from '../../domain/personas'
import { SaveButton } from '../ahead/common'

/** Why a change was refused, in words that say what to do next. Falls back to the general wording. */
export function AboardError({ error }: { error: ApiError | null }) {
  if (!error) return null
  if (error.code === 'conflict' || error.code === 'invalid' || error.code === 'forbidden') {
    const text = t(`ab.err.${error.message}` as StringKey)
    if (!text.startsWith('ab.err.')) return <p role="alert" className="field__error">{text}</p>
  }
  return <ActionError error={error} />
}

export function Back({ to, label }: { to: string; label: string }) {
  return <p className="book-nav"><Link to={to}>{label}</Link></p>
}

/** The note shown above anything that changes the account when the signed-in person is a supervised child. */
export function ChildNote() {
  const me = usePersona()
  if (!me?.child) return null
  return <SupervisedNote booker={personaById(me.booker)?.firstName ?? ''} />
}

const ordinal = (day: number) => t('ab.day', { day })

/** A bookable or joinable item with its days, times and price, and the controls for its mode (ENT-03, SHP-01, SHP-04, SHP-06, ACS-04). */
export function ItemCard({ item, mine, reload, canEdit, day }: { item: Item; mine: Selection[]; reload: () => void; canEdit: boolean; day: number | null }) {
  const days = day === null ? item.days : item.days.filter((x) => x === day)
  const [pick, setPick] = useState<{ day: number; time: string }>({ day: days[0] ?? 0, time: item.times[0] ?? '' })
  const [qty, setQty] = useState(1)
  const add = useAction(async (s: Selection) => { await api.aboard.selections.add(s); reload() })
  const remove = useAction(async (id: string) => { await api.aboard.selections.remove(id); reload() })
  const place = placeById(item.placeId)
  const asked = item.mode === 'order' ? { item: item.id, day: 0, time: '', qty } : { item: item.id, day: pick.day, time: pick.time, qty: 1 }
  const left = placesLeft(item, asked.day, asked.time, mine.filter((m) => m.item === item.id && m.day === asked.day && m.time === asked.time).reduce((n, m) => n + m.qty, 0))
  const has = mine.filter((m) => m.item === item.id)
  const own = (m: Selection) => `${m.item}@${m.day}@${m.time}`
  return (
    <Card>
      <h3 className="card__title">{item.title}</h3>
      <p>{item.detail}</p>
      <p className="muted">
        {place ? `${place.name}, ${t('ab.deck', { deck: place.deck })}. ` : ''}
        {item.minutes > 0 && item.times.length > 0 ? t('ab.runs', { minutes: item.minutes }) : ''}
        {item.price !== null ? ` ${item.price === 0 ? t('ab.free') : formatMoney(item.price)}` : ''}
        {item.minAge > 0 ? ` ${t('ab.minAge', { age: item.minAge })}` : ''}
      </p>
      <p><SaveButton saveKey={`item:${item.id}`} name={item.title} /></p>
      {item.support && <p>{item.support.map((s) => <StatusBadge key={s} kind="ready" label={t(`ab.support.${s}` as StringKey)} />)}</p>}
      {has.length > 0 && (
        <ul className="plain-bullets">
          {has.map((m) => (
            <li key={own(m)}>
              {m.day > 0 ? `${ordinal(m.day)} ${formatTime(m.time || '00:00')}` : t('ab.ordered', { count: m.qty })}
              {chargeFor(m) > 0 && ` · ${formatMoney(chargeFor(m))}`}{' '}
              <Button variant="tertiary" disabled={remove.busy || !canEdit} onClick={() => void remove.run(own(m))}>{t('ab.remove')}</Button>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="ab-controls">
          {item.mode !== 'order' && (
            <>
              <div className="field">
                <label htmlFor={`${item.id}-day`}>{t('ab.chooseDay')}</label>
                <select id={`${item.id}-day`} className="field__input" value={pick.day} onChange={(e) => setPick({ ...pick, day: Number(e.target.value) })}>
                  {days.map((x) => <option key={x} value={x}>{ordinal(x)}</option>)}
                </select>
              </div>
              {item.times.length > 0 && (
                <div className="field">
                  <label htmlFor={`${item.id}-time`}>{t('ab.chooseTime')}</label>
                  <select id={`${item.id}-time`} className="field__input" value={pick.time} onChange={(e) => setPick({ ...pick, time: e.target.value })}>
                    {item.times.map((x) => <option key={x} value={x}>{formatTime(x)} to {formatTime(endTime(x, item.minutes))}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          {item.mode === 'order' && (
            <div className="field">
              <label htmlFor={`${item.id}-qty`}>{t('ab.qty')}</label>
              <select id={`${item.id}-qty`} className="field__input" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
          {left !== null && <p className="muted" role="status">{left === 0 ? t('ab.full') : t('ab.left', { count: left })}</p>}
          <AboardError error={add.error ?? remove.error} />
          <Button variant="secondary" disabled={add.busy || left === 0 || days.length === 0} onClick={() => void add.run(asked)}>
            {item.mode === 'book' ? t('ab.book') : item.mode === 'order' ? t('ab.order') : t('ab.going')}
          </Button>
        </div>
      )}
    </Card>
  )
}

/** A list of catalogue items for a group with the guest's own picks, loaded for the signed-in person. */
export function ItemList({ items, day = null }: { items: readonly Item[]; day?: number | null }) {
  const picks = useMine(() => api.aboard.selections.list())
  const me = usePersona()
  return (
    <Load state={picks}>
      {(list) => (
        <>
          <ChildNote />
          <ul className="card-grid">
            {items.map((i) => (
              <li key={i.id}><ItemCard item={i} mine={list.filter((p) => p.item === i.id)} reload={picks.retry} canEdit={!me?.child} day={day} /></li>
            ))}
          </ul>
        </>
      )}
    </Load>
  )
}

/** What the guest has picked so far, with the total for the account. */
export function MyPicks({ groups }: { groups: readonly Item['group'][] }) {
  const picks = useMine(() => api.aboard.selections.list())
  return (
    <Load state={picks}>
      {(list) => {
        const mine = list.filter((p) => groups.includes(itemById(p.item)?.group ?? 'shop'))
        if (mine.length === 0) return <p className="muted">{t('ab.nothingYet')}</p>
        const total = mine.reduce((n, p) => n + p.total, 0)
        return (
          <Banner kind="info" title={t('ab.mine')}>
            <ul className="plain-bullets">
              {mine.map((p) => <li key={p.id}>{itemById(p.item)?.title}{p.day > 0 ? `, ${ordinal(p.day)} ${formatTime(p.time || '00:00')}` : p.qty > 1 ? ` × ${p.qty}` : ''}{p.total > 0 ? ` · ${formatMoney(p.total)}` : ''}</li>)}
            </ul>
            {total > 0 && <p>{t('ab.onAccount', { total: formatMoney(total) })} <Link to="/me/bill">{t('route.bill')}</Link></p>}
          </Banner>
        )
      }}
    </Load>
  )
}
