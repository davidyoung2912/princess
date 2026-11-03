import { useState } from 'react'
import type { PlanDay } from '../../domain/plan'
import { OPEN_DAYS_BEFORE } from '../../domain/checkin'
import { CRUISE, formatDate } from '../../domain/cruise'
import { bagTagCard, certificateCard, journeyCalendar, keepsakeCard, MOMENT_MAX, momentCard, nextYearHold, planCalendar, posterCard, sameWeekNextYear, type Card as CardData } from '../../domain/export'
import { formatMoney } from '../../domain/money'
import { itinerary, sailingNights, type Sailing } from '../../domain/sailings'
import { SHIP } from '../../domain/ship'
import { useNow, useSailing } from '../../hooks/useDemo'
import { t, th } from '../../i18n'
import { Card } from '../Card'
import { CopyText } from '../CopyText'
import { Field } from '../Field'
import { CalendarButton, PrintCard } from './Cards'
import { usePickedPhoto } from './cardTools'

/** D2-4: one calendar file for the whole journey. */
export function JourneyCalendarButton({ number, sailing, finalDue, balance }: { number: string; sailing: Sailing; finalDue: string; balance: number }) {
  const now = useNow()
  return (
    <CalendarButton
      name={`journey-${number}.ics`} label={t('dl.cal.journey')}
      make={() => journeyCalendar({ number, sailing, finalDue: balance > 0 ? finalDue : '', balanceText: balance > 0 ? formatMoney(balance) : '', checkinOpensDaysBefore: OPEN_DAYS_BEFORE, home: CRUISE.homePort, shipName: SHIP.name, stamp: now })}
    />
  )
}

/** D4-7 and D4-8: the plan to a calendar (a day or the week) and a poster of the week. */
export function PlanExports({ days }: { days: readonly PlanDay[] }) {
  const sailing = useSailing()
  const now = useNow()
  const hasAny = days.some((d) => d.entries.length > 0)
  return (
    <Card labelledBy="plan-exp-h">
      <h2 id="plan-exp-h" className="card__title">{th('dl.plan.title')}</h2>
      <p>{t('dl.plan.body')}</p>
      <div className="button-row">
        <CalendarButton name="week.ics" label={t('dl.plan.week')} make={() => planCalendar(days, 'week', 1, sailing, CRUISE.homePort, now)} />
      </div>
      {!hasAny && <p className="muted">{t('dl.plan.empty')}</p>}
      <p className="muted">{t('dl.plan.note')}</p>
      <PrintCard label={t('dl.poster.label')} card={posterCard({ title: t('dl.poster.title'), sailing, plan: days, shipName: SHIP.name })} />
    </Card>
  )
}

/** D4-7: one day to a calendar. */
export function DayCalendarButton({ day, days }: { day: number; days: readonly PlanDay[] }) {
  const sailing = useSailing()
  const now = useNow()
  const d = days.find((x) => x.day === day)
  if (!d || d.entries.length === 0) return null
  return <CalendarButton variant="tertiary" name={`day-${day}.ics`} label={t('dl.plan.day', { n: day })} make={() => planCalendar(days, 'day', day, sailing, CRUISE.homePort, now)} />
}

/** D3-6: bag tags to print with a large-print option. */
export function BagTagCards({ guests, number }: { guests: readonly { printed: string; cabin: string; deck: number }[]; number: string }) {
  const sailing = useSailing()
  const [large, setLarge] = useState(false)
  return (
    <section aria-labelledby="dl-tag-h">
      <h2 id="dl-tag-h">{th('dl.tag.title')}</h2>
      <label className="choice no-print"><input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} /><span>{t('dl.tag.large')}</span></label>
      {guests.map((g) => <PrintCard key={g.printed + g.cabin} label={t('dl.tag.label', { name: g.printed })} card={bagTagCard({ ...g, number, sailing, shipName: SHIP.name, home: CRUISE.homePort, large })} />)}
      <p className="muted no-print">{t('dl.tag.note')}</p>
    </section>
  )
}

/** D1-8: the side-by-side as a card to share. */
export function ShareCard({ card, link }: { card: CardData; link: string }) {
  return (
    <>
      <PrintCard label={t('dl.compare.label')} card={card} />
      <h3 className="no-print">{th('dl.compare.link')}</h3>
      <p className="muted no-print">{t('dl.compare.linkBody')}</p>
      <div className="no-print"><CopyText text={link} label={t('dl.compare.linkCopy')} /></div>
    </>
  )
}

/** D8-6, D8-4, D8-9, D7-5: the keepsakes at the end of a trip. */
export function Keepsakes({ names, ports, seaDays, nauticalMiles, dinners, tours }: { names: readonly string[]; ports: readonly string[]; seaDays: number; nauticalMiles: number; dinners: readonly string[]; tours: readonly string[] }) {
  const sailing = useSailing()
  const now = useNow()
  const days = itinerary(sailing)
  const dates = `${formatDate(days[0].date)} to ${formatDate(days[days.length - 1].date)}`
  const who = names.join(' and ') || t('dl.keep.you')
  const [line, setLine] = useState('')
  const { photo, pick, clear } = usePickedPhoto()
  const certificate = certificateCard({ name: who, nights: sailingNights(sailing), ports, seaDays, nauticalMiles, shipName: SHIP.name, dates })
  return (
    <Card labelledBy="dl-keep-h">
      <h2 id="dl-keep-h" className="card__title no-print">{th('dl.keep.title')}</h2>
      <h3 className="no-print">{th('dl.moment.title')}</h3>
      <div className="no-print">
        <Field label={t('dl.moment.line')} hint={t('dl.moment.hint', { max: MOMENT_MAX })} value={line} maxLength={MOMENT_MAX} onChange={(e) => setLine(e.target.value)} />
        <label htmlFor="dl-moment-photo">{t('dl.moment.photo')}</label>
        <input id="dl-moment-photo" type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
        {photo && <button type="button" className="btn btn--tertiary" onClick={clear}>{t('dl.moment.drop')}</button>}
        <p className="muted">{t('dl.moment.private')}</p>
      </div>
      {line.trim() && <PrintCard label={t('dl.moment.label')} photo={photo} card={momentCard(line, who, dates)} />}
      <h3 className="no-print">{th('dl.cert.title')}</h3>
      <PrintCard label={t('dl.cert.title')} card={certificate} />
      <h3 className="no-print">{th('dl.keepsake.title')}</h3>
      <PrintCard label={t('dl.keepsake.title')} card={keepsakeCard({ title: t('dl.keepsake.heading', { who }), sailing, dinners, tours, shipName: SHIP.name })} />
      <h3 className="no-print">{th('dl.hold.title')}</h3>
      <p className="no-print">{t('dl.hold.body', { date: formatDate(sameWeekNextYear(sailing.departure)) })}</p>
      <div className="button-row no-print"><CalendarButton name="next-year-hold.ics" label={t('dl.hold.button')} make={() => nextYearHold(sailing, sailingNights(sailing), SHIP.name, now)} /></div>
    </Card>
  )
}
