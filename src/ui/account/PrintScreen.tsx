import { useState } from 'react'
import { Link } from 'react-router'
import { ALTERNATIVES } from '../../domain/alternatives'
import { placeById } from '../../domain/deck'
import { formatDate, formatTime } from '../../domain/cruise'
import { eventsOn } from '../../domain/program'
import { itinerary, PORTS } from '../../domain/sailings'
import { TOP_TASKS } from '../../routes/nav'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { useDemo, useSailing } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Printer } from '../icons'
import { names } from '../plan/people'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'

type Sheet = 'plan' | 'itinerary' | 'tickets' | 'help'

/**
 * Paper copies (INC-01, ACS-06): the daily plan, the itinerary, excursion tickets and the "no app" sheet, each in plain black on white with a
 * large-print option. Printing uses the browser's own Print (or Save as PDF); only the chosen sheet is printed.
 */
export function PrintScreen() {
  const s = useSailing()
  const demo = useDemo()
  const [sheet, setSheet] = useState<Sheet>('plan')
  const [day, setDay] = useState(2)
  const [large, setLarge] = useState(false)
  return (
    <div className="page page--print">
      <h1 className="no-print">{t('route.print')}</h1>
      <div className="no-print">
        <p>{t('prt.intro')}</p>
        <fieldset>
          <legend>{t('prt.which')}</legend>
          {(['plan', 'itinerary', 'tickets', 'help'] as const).map((x) => (
            <label key={x} className="choice">
              <input type="radio" name="sheet" checked={sheet === x} onChange={() => setSheet(x)} />
              {t(`prt.sheet.${x}` as StringKey)}
            </label>
          ))}
        </fieldset>
        {sheet === 'plan' && (
          <div className="field">
            <label htmlFor="prt-day">{t('onb.planner.day')}</label>
            <select id="prt-day" className="field__input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {itinerary(s).map((d) => <option key={d.day} value={d.day}>{t('plan.day', { n: d.day })} · {formatDate(d.date)}</option>)}
            </select>
          </div>
        )}
        <label className="choice">
          <input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} />
          <span>{t('prt.large')}<small>{t('prt.largeHint')}</small></span>
        </label>
        <p><Button onClick={() => window.print()}><Printer aria-hidden="true" /> {t('prt.print')}</Button></p>
        <p className="muted">{t('prt.pass')} <Link to="/home/boarding-pass">{t('route.boardingPass')}</Link></p>
      </div>

      <article className={['print-sheet', large ? 'print-sheet--large' : ''].filter(Boolean).join(' ')} aria-label={t(`prt.sheet.${sheet}` as StringKey)}>
        {sheet === 'plan' && <PlanSheet day={day} changes={demo.scenarios.includes('planChange')} />}
        {sheet === 'itinerary' && <ItinerarySheet />}
        {sheet === 'tickets' && <TicketsSheet />}
        {sheet === 'help' && <HelpSheet />}
        <p className="print-sheet__foot">{t('prt.foot')}</p>
      </article>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function PlanSheet({ day, changes }: { day: number; changes: boolean }) {
  const s = useSailing()
  const shipTime = useShipTime()
  const date = itinerary(s)[day - 1]
  const events = eventsOn(s, day, changes)
  return (
    <>
      <h2>{t('prt.plan.title', { day, date: formatDate(date.date), place: date.port === 'sea' ? t('onb.atSea') : PORTS[date.port].name })}</h2>
      {date.allAboard && <p><strong>{t('prt.allAboard', { time: formatTime(date.allAboard) })}</strong></p>}
      <table className="print-table">
        <thead><tr><th scope="col">{t('prt.time')}</th><th scope="col">{t('prt.what')}</th><th scope="col">{t('prt.where')}</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{shipTime(e.startAt)}</td>
              <td>{e.title}{e.status === 'cancelled' ? ` (${t('onb.cancelled')})` : e.status === 'moved' ? ` (${t('onb.moved', { time: shipTime(e.startAt) })})` : ''}</td>
              <td>{placeById(e.placeId)?.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function ItinerarySheet() {
  const s = useSailing()
  return (
    <>
      <h2>{t('prt.itin.title')}</h2>
      <table className="print-table">
        <thead><tr><th scope="col">{t('prt.day')}</th><th scope="col">{t('prt.date')}</th><th scope="col">{t('prt.port')}</th><th scope="col">{t('prt.times')}</th></tr></thead>
        <tbody>
          {itinerary(s).map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{formatDate(d.date)}</td>
              <td>{d.port === 'sea' ? t('onb.atSea') : PORTS[d.port].name}</td>
              <td>{[d.arrive && t('prt.arrive', { time: formatTime(d.arrive) }), d.allAboard && t('prt.allAboard', { time: formatTime(d.allAboard) }), d.depart && t('prt.depart', { time: formatTime(d.depart) })].filter(Boolean).join(' · ') || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function TicketsSheet() {
  const tours = useAsync(() => api.plan.excursions.list(), [])
  if (!tours.data) return <p role="status" className="muted">{t('account.loading')}</p>
  const booked = tours.data.booked.filter((b) => b.status === 'booked')
  return (
    <>
      <h2>{t('prt.tickets.title')}</h2>
      {booked.length === 0 ? <p>{t('res.noTours')}</p> : booked.map((b) => {
        const offer = tours.data!.offers.find((o) => o.item.id === b.excursionId)
        if (!offer) return null
        return (
          <section key={b.id} className="print-ticket" aria-label={offer.item.name}>
            <h3>{offer.item.name}</h3>
            <p>{t('res.tourWhen', { date: formatDate(offer.date), time: formatTime(offer.item.start), back: formatTime(offer.backBy) })}</p>
            <p>{t('prt.meet', { place: offer.item.meeting })}</p>
            <p>{t('prt.guests', { names: names(b.guests) })}</p>
            <p>{t('prt.ref', { id: b.id.slice(-8).toUpperCase() })}</p>
          </section>
        )
      })}
      <p>{t('prt.tickets.note')}</p>
    </>
  )
}

function HelpSheet() {
  return (
    <>
      <h2>{t('prt.help.title')}</h2>
      <p>{t('prt.help.intro')}</p>
      <dl className="print-dl">
        {TOP_TASKS.map((task) => <div key={task.id}><dt>{t(task.labelKey)}</dt><dd>{t(ALTERNATIVES[task.id])}</dd></div>)}
      </dl>
    </>
  )
}
