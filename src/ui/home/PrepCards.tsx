import { Link } from 'react-router'
import { dndNow } from '../../domain/aboardMore'
import { offersQuiet } from '../../domain/finishMore'
import { firstIncomplete } from '../../domain/booking'
import { companionWeek } from '../../domain/prepMore'
import { sailingById, shipZoneAt } from '../../domain/sailings'
import { dateIn, timeIn } from '../../domain/timezones'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { useSettings } from '../../hooks/useSettings'
import { t, th, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'

/** Weekly companion (S3-03): at most one note a week from eight weeks out. It is a nudge, so it is silent when the budget is zero or calm mode is on, and one tap turns it off. */
export function CompanionCard({ daysToDeparture }: { daysToDeparture: number }) {
  const { state, update } = useMemory()
  const [settings] = useSettings()
  const week = companionWeek(daysToDeparture)
  const sailing = useSailing()
  const now = useNow()
  const quiet = dndNow(state.aboard.dnd, timeIn(now, shipZoneAt(sailing, now)), 'offers')
  if (week === null || quiet || offersQuiet(state.finish) || state.companionOff || settings.nudgesPerDay === 0 || settings.calm) return null
  return (
    <Card labelledBy="comp-h">
      <h2 id="comp-h" className="card__title">{th('weekly.title', { n: week })}</h2>
      <p>{t(`weekly.note.${week}` as StringKey)}</p>
      <Button variant="tertiary" onClick={() => update((m) => ({ ...m, companionOff: true }))}>{t('weekly.off')}</Button>
    </Card>
  )
}

/** Continue where you stopped (S2-10): shown only when a booking draft with something in it is saved. The draft itself is kept by the booking funnel. */
export function ContinueBookingCard() {
  const saved = useMine(() => api.booking.draft())
  const d = saved.data
  const today = dateIn(useNow(), 'America/New_York')
  if (!d || (d.category === '' && d.people.every((p) => p.firstName === '' && p.lastName === ''))) return null
  return (
    <Card labelledBy="cont-h">
      <h2 id="cont-h" className="card__title">{th('continue.title')}</h2>
      <p>{t('continue.body')}</p>
      <p>{t('continue.at', { step: t(`book.step.${firstIncomplete(d, { departure: sailingById(d.sailingId)?.departure ?? null, today })}` as StringKey) })}</p>
      <LinkButton to="/book">{t('continue.go')}</LinkButton>
      <p className="muted"><Link to={`/book/resume/${d.id}`}>{t('continue.link')}</Link></p>
    </Card>
  )
}
