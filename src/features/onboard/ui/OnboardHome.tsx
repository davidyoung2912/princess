import { PathLinkList } from '../../../shared/ui/ScreenList'
import { ChatNeedsYou } from '../../chat/ui/ChatNeedsYou'
import { Link } from 'react-router'
import { formatTemp } from '../../../domain/readiness'
import { useSettings } from '../../../shared/hooks/useSettings'
import { asDiningView, asProgramView } from '../../../shared/api/guards'
import type { OnboardToday } from '../../../shared/api/types'
import { nowAndNext } from '../../../domain/program'
import { formatDate, formatTime } from '../../../domain/cruise'
import { venueById } from '../../../domain/dining'
import { PORTS } from '../../../domain/sailings'
import { api } from '../../../app/runtime'
import { useNow, usePersona, useSailing } from '../../../shared/hooks/useDemo'
import { useSavedCopy } from '../../../shared/hooks/useSavedCopy'
import { t, th } from '../../../shared/i18n'
import { Banner } from '../../../shared/ui/Banner'
import { LinkButton } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { Saved } from './common'
import { useShipTime } from './shipTime'
import { PortCard } from './PortCard'
import { DisembarkCard } from '../../finish/ui/HomeCards'
import { HomeBudgetAlert } from './BudgetCard'
import { UpdatesBanner } from './Updates'
import { CelebrationDay, DressBadge, FavouritesTonight } from '../../delights/ui/SeaDelights'
import { StanleyMoment } from '../../stanley/ui/StanleyMoment'
import { SendEventToChat, SendToChat } from './SendToChat'
import { useClockMoment } from '../../../shared/hooks/useClockMoments'

/** The contextual home on board (OB-01): where the ship is, the all-aboard card, what is on next, tonight's table and the muster drill. Works from the copy saved on the phone. */
export function OnboardHome({ today }: { today: OnboardToday }) {
  const [settings] = useSettings()
  const me = usePersona()
  const now = useNow()
  const shipTime = useShipTime()
  const day = today.day ?? 1
  const program = useSavedCopy('program', `${me?.id ?? 'none'}:${day}`, () => api.onboard.program(day), asProgramView, [me?.id, day])
  const dining = useSavedCopy('dining', me?.booker ?? 'none', () => api.plan.dining.view(), asDiningView, [me?.id])
  const place = today.port === 'sea' ? t('onb.atSea') : PORTS[today.port].name
  const sailing = useSailing()
  const sailAway = useClockMoment('sailAway')
  return (
    <>
      {sailAway && today.day === 1 && <StanleyMoment id="sailAway" subject={sailing.id} />}
      <Card hero labelledBy="now-h">
        <h2 id="now-h" className="card__title">{th('onb.today', { day: today.day ?? 0, date: formatDate(today.date) })}</h2>
        <p className="onb__place"><strong>{place}</strong></p>
        {today.weather && <p>{t('onb.weather', { summary: today.weather.summary, high: formatTemp(today.weather.highF, settings.units), low: formatTemp(today.weather.lowF, settings.units) })} {today.weather.sea}</p>}
        {today.sailAwayAt && <p>{t('onb.sailAway', { time: shipTime(today.sailAwayAt) })}</p>}
      </Card>

      {today.day !== null && <DressBadge day={today.day} />}
      <CelebrationDay date={today.date} />
      <ChatNeedsYou /><UpdatesBanner />
      <HomeBudgetAlert />

      {today.clockChange && (
        <Banner kind="warning" title={t('onb.clockChange', { count: Math.abs(today.clockChange.hours), time: shipTime(today.clockChange.at), dir: t(today.clockChange.hours < 0 ? 'onb.clockBack' : 'onb.clockForward') })}>
          <p>{t('onb.clockChangeBody')}</p>
        </Banner>
      )}

      <DisembarkCard />

      {today.muster.required && (
        <Banner kind="warning" title={t('onb.muster.banner')} action={<LinkButton to="/ship/muster" variant="secondary">{t('route.muster')}</LinkButton>}>
          <p>{t('onb.muster.bannerBody', { time: shipTime(today.muster.at) })}</p>
        </Banner>
      )}

      {today.portDay && <PortCard view={today.portDay} compact />}

      <Saved copy={program}>
        {(p) => {
          const { now: onNow, next } = nowAndNext(p.events, now)
          const mineNext = next.filter((e) => p.mine.includes(e.id))
          return (
            <Card labelledBy="next-events-h">
              <h2 id="next-events-h" className="card__title">{th('onb.next.title')}</h2>
              {p.changed && <Banner kind="warning" title={t('onb.changed')}><p><Link to="/plan">{t('onb.changed.see')}</Link></p></Banner>}
              {onNow.length === 0 && next.length === 0 ? <p className="muted">{t('onb.next.none')}</p> : (
                <ul className="plain-bullets">
                  {onNow.slice(0, 3).map((e) => <li key={e.id}><strong>{t('onb.happening')}</strong> {e.title}</li>)}
                  {next.slice(0, 3).map((e) => <li key={e.id}><strong>{shipTime(e.startAt)}</strong> {e.title}{mineNext.includes(e) ? ` (${t('onb.inMyPlan')})` : ''} <SendEventToChat planRef={`${e.id}:${day}`} title={e.title} /></li>)}
                </ul>
              )}
              <p><Link to="/plan">{t('onb.next.all')}</Link></p>
            </Card>
          )
        }}
      </Saved>

      <Saved copy={dining}>
        {(v) => {
          const upcoming = v.reservations.filter((r) => r.day === (today.day ?? 0))
          return (
            <Card labelledBy="tonight-h">
              <h2 id="tonight-h" className="card__title">{th('onb.tonight')}</h2>
              {upcoming.length === 0 ? <p>{v.seating ? t('onb.tonight.fixed', { time: formatTime(v.seating) }) : t('onb.tonight.none')}</p> : (
                <ul className="plain-bullets">{upcoming.map((r) => <li key={r.id}><Link to={`/plan/reservations/${r.id}`}>{venueById(r.venueId)?.name ?? r.venueId}, {r.time}</Link> <SendToChat shareRef={`dining:${r.id}`} title={venueById(r.venueId)?.name ?? r.venueId} /></li>)}</ul>
              )}
              <p><Link to="/plan/reservations">{t('route.reservations')}</Link></p>
            </Card>
          )
        }}
      </Saved>

      <FavouritesTonight />

      <nav aria-labelledby="onb-links-h">
        <h2 id="onb-links-h">{th('onb.quick')}</h2>
        <PathLinkList items={[{ path: '/home/boarding-pass' }, { path: '/ship/emergency' }, { path: '/ship/map' }, { path: '/me/bill' }, { path: '/chat' }]} />
      </nav>
    </>
  )
}
