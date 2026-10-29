import { useState } from 'react'
import { Link } from 'react-router'
import type { HoldView, RebookOption, RebookView } from '../../api/finishTypes'
import { DESK, HOLD_DAYS } from '../../domain/postcruise'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { formatDateTime } from '../account/format'
import { ExtraError } from '../extras/common'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { Human } from './common'

/** Book your next cruise (POS-06): hold a date and a price, with the bigger offer on board, future cruise credit, and an appointment at the Future Cruise desk. */
export function RebookScreen() {
  const view = useMine(() => api.post.rebook(), [])
  return (
    <div className="page">
      <h1>{t('route.rebook')}</h1>
      <p>{t('reb.intro')}</p>
      <Load state={view}>{(v) => <Rebook v={v} reload={view.retry} />}</Load>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function Rebook({ v, reload }: { v: RebookView; reload: () => void }) {
  const hold = useAction(async (id: string) => { await api.post.hold(id); reload() })
  const release = useAction(async (id: string) => { await api.post.releaseHold(id); reload() })
  const convert = useAction(async () => { await api.post.convertFcc(); reload() })
  const heldDates = new Set(v.holds.filter((h) => !h.expired).map((h) => h.departure))
  return (
    <>
      {v.onboardOffer
        ? <Banner kind="success" title={t('reb.onboard')}><p>{t('reb.onboardBody', { deposit: formatMoney(10_000), credit: formatMoney(v.options[0]?.credit ?? 0) })}</p></Banner>
        : <Banner kind="info" title={t('reb.after')}><p>{t('reb.afterBody')}</p></Banner>}
      <ExtraError error={hold.error ?? release.error ?? convert.error} />

      {v.holds.length > 0 && (
        <section aria-labelledby="reb-holds-h">
          <h2 id="reb-holds-h">{t('reb.holds')}</h2>
          <ul className="order-list">{v.holds.map((h) => <Hold key={h.id} h={h} busy={release.busy} onRelease={() => void release.run(h.id)} />)}</ul>
        </section>
      )}

      <section aria-labelledby="reb-dates-h">
        <h2 id="reb-dates-h">{t('reb.dates')}</h2>
        <p className="muted">{t('reb.for', { room: t(`reb.room.${v.category}` as StringKey), count: v.guests })}</p>
        {v.options.length === 0 ? <p>{t('reb.noDates')}</p> : (
          <ul className="order-list">{v.options.map((o) => <Option key={o.id} o={o} held={heldDates.has(o.departure)} canHold={v.canHold} busy={hold.busy} onHold={() => void hold.run(o.id)} />)}</ul>
        )}
        <p className="muted">{t('reb.protect')}</p>
        <p className="muted">{t('reb.others')}</p>
      </section>

      <Card labelledBy="reb-fcc-h">
        <h2 id="reb-fcc-h" className="card__title">{t('reb.fcc')}</h2>
        {v.fccLeft === 0 && v.fccConverted === 0 ? <p>{t('reb.fccNone')}</p> : (
          <>
            <p>{t('reb.fccLeft', { amount: formatMoney(v.fccLeft) })}</p>
            {v.fccConverted > 0 && <p>{t('reb.fccConverted', { amount: formatMoney(v.fccConverted) })}</p>}
            {v.fccLeft > 0 && (v.onboardOffer
              ? <Button variant="secondary" disabled={convert.busy} onClick={() => void convert.run()}>{convert.busy ? t('account.saving') : t('reb.fccConvert', { amount: formatMoney(v.fccLeft) })}</Button>
              : <p className="muted">{t('reb.fccOnboard')}</p>)}
          </>
        )}
      </Card>

      <Desk v={v} reload={reload} />
      <Human />
    </>
  )
}

function Option({ o, held, canHold, busy, onHold }: { o: RebookOption; held: boolean; canHold: boolean; busy: boolean; onHold: () => void }) {
  return (
    <li className="order">
      <h3 className="order__title">{formatDate(o.departure)}</h3>
      <p>{t('reb.total', { amount: formatMoney(o.total) })} · {t('reb.deposit', { amount: formatMoney(o.deposit) })}{o.credit > 0 && <> · {t('reb.credit', { amount: formatMoney(o.credit) })}</>}</p>
      {!o.bookable && <p className="muted">{t('reb.notOpen')}</p>}
      {held ? <p role="status"><strong>{t('reb.held')}</strong></p> : canHold ? <Button variant="secondary" disabled={busy} onClick={onHold}>{t('reb.hold', { days: HOLD_DAYS })}</Button> : <p className="muted">{t('reb.cannotHold')}</p>}
    </li>
  )
}

function Hold({ h, busy, onRelease }: { h: HoldView; busy: boolean; onRelease: () => void }) {
  return (
    <li className="order">
      <h3 className="order__title">{formatDate(h.departure)}</h3>
      <p>{t('reb.total', { amount: formatMoney(h.total) })} · {t('reb.depositDue', { amount: formatMoney(h.deposit - h.fccApplied) })}{h.fccApplied > 0 && <> · {t('reb.fccUsed', { amount: formatMoney(h.fccApplied) })}</>}</p>
      {h.credit > 0 && <p>{t('reb.creditPosted', { amount: formatMoney(h.credit) })}</p>}
      <p role="status"><strong>{h.expired ? t('reb.expired') : t('reb.until', { time: formatDateTime(h.expiresAt) })}</strong></p>
      {h.bookable && !h.expired && <LinkButton to="/book" variant="secondary">{t('reb.continue')}</LinkButton>}
      <Button variant="tertiary" disabled={busy} onClick={onRelease}>{t('reb.release')}</Button>
    </li>
  )
}

function Desk({ v, reload }: { v: RebookView; reload: () => void }) {
  const shipTime = useShipTime()
  const [slot, setSlot] = useState('')
  const book = useAction(async () => { await api.post.bookSlot(Number(slot)); setSlot(''); reload() })
  const cancel = useAction(async () => { await api.post.cancelSlot(); reload() })
  return (
    <Card labelledBy="reb-desk-h">
      <h2 id="reb-desk-h" className="card__title">{t('reb.desk')}</h2>
      <p>{t('reb.deskBody', { place: DESK.place })}</p>
      {v.appointment && (
        <>
          <p role="status"><strong>{t('reb.apptAt', { time: `${formatDateTime(v.appointment.at)}` })}</strong></p>
          <ExtraError error={cancel.error} />
          <Button variant="tertiary" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('reb.apptCancel')}</Button>
        </>
      )}
      {v.slots.length > 0 ? (
        <form onSubmit={(e) => { e.preventDefault(); if (slot) void book.run() }}>
          <div className="field">
            <label htmlFor="reb-slot">{v.appointment ? t('reb.apptMove') : t('reb.apptPick')}</label>
            <select id="reb-slot" className="field__input" value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">{t('reb.apptChoose')}</option>
              {v.slots.map((s) => <option key={s.at} value={s.at}>{t('plan.day', { n: s.day })} · {shipTime(s.at)}</option>)}
            </select>
          </div>
          <ExtraError error={book.error} />
          <Button type="submit" variant="secondary" disabled={book.busy || !slot}>{book.busy ? t('account.saving') : t('reb.apptBook')}</Button>
        </form>
      ) : <p className="muted">{t('reb.apptOnboard')}</p>}
      <p className="muted"><Link to="/home/disembark">{t('route.disembark')}</Link></p>
    </Card>
  )
}
