import { Link, useLocation, useNavigate } from 'react-router'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { jumpTo } from '../demo/store'
import { dayLabel, dayLabelLong, timeIn, zonedToEpoch } from '../domain/timezones'
import { clockTime } from '../domain/syncAge'
import { tripStatus } from '../domain/tripStatus'
import { isExplorerPath } from '../routes/stageNav'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { useNow, useSailing } from '../hooks/useDemo'
import { t } from '../i18n'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { ChevronLeft, ChevronRight, CloudSun, Compass, Drama, MapPin, MessagesSquare, Plan, RouteMap, Activities, ShipExplorer, Exercise, ShoppingBag, Spa, UtensilsCrossed } from './icons'
import { Field } from './Field'

const AT_LINKS = [
  { to: '/chat', Icon: MessagesSquare, label: 'testbar.at.chat' },
  { to: '/today', Icon: Plan, label: 'testbar.at.today' },
  { to: '/dining-today', Icon: UtensilsCrossed, label: 'testbar.at.dining' },
  { to: '/entertainment', Icon: Drama, label: 'testbar.at.entertainment' },
  { to: '/shopping-today', Icon: ShoppingBag, label: 'testbar.at.shopping' },
  { to: '/excursions-explorer', Icon: MapPin, label: 'testbar.at.excursions' },
  { to: '/spa-explorer', Icon: Spa, label: 'testbar.at.spa' },
  { to: '/exercise-explorer', Icon: Exercise, label: 'testbar.at.exercise' },
  { to: '/activities-explorer', Icon: Activities, label: 'testbar.at.activities' },
  { to: '/ship-explorer', Icon: ShipExplorer, label: 'testbar.at.ship' },
  { to: '/weather', Icon: CloudSun, label: 'testbar.at.weather' },
  { to: '/nautical', Icon: Compass, label: 'testbar.at.nautical' },
  { to: '/itinerary', Icon: RouteMap, label: 'testbar.at.itinerary' },
] as const

/**
 * The ship date with the guest's stage under it (the stage opens the stage welcome page). For demo accounts only, the date and a time block (whose clock it is under it) open a
 * picker that moves the testing date, which changes the guest's stage and what every screen shows. Demo accounts only.
 */
export function TestBar({ menu }: { menu?: ReactNode }) {
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  if (!context) return null
  return <TestBarBody isDemo={context.isDemo === true} menu={menu} />
}

function TestBarBody({ isDemo, menu }: { isDemo: boolean; menu?: ReactNode }) {
  const position = useJourneyPosition()
  const now = useNow()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const stage = t(`journey.stage.${position.stage}`)
  const sailing = useSailing()
  const status = tripStatus(sailing, position.day)
  // On phones the ship information links are a sideways carousel: the arrows page it, and choosing (or tabbing to) a button brings it fully into view.
  const track = useRef<HTMLElement>(null)
  const [edges, setEdges] = useState({ start: false, end: true })
  const measure = useCallback(() => {
    const el = track.current
    if (el) setEdges({ start: el.scrollLeft > 1, end: Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 1 })
  }, [])
  // The window shows a whole number of buttons, and scroll snapping lines the buttons up with its edges, so a drag that lets go never leaves a button cut in half.
  const fit = useCallback(() => {
    const el = track.current
    const box = el?.parentElement
    const arrow = box?.querySelector<HTMLElement>('.testbar__arrow')
    const link = el?.firstElementChild as HTMLElement | null
    if (!el || !box || !arrow || !link) return
    if (getComputedStyle(arrow).display === 'none') { el.style.width = ''; el.style.marginInlineStart = ''; measure(); return }
    el.style.width = ''
    el.style.marginInlineStart = ''
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    const pitch = link.offsetWidth + gap
    const room = box.clientWidth - 2 * arrow.offsetWidth - 2 * (parseFloat(getComputedStyle(box).columnGap) || 0)
    const count = Math.max(1, Math.min(AT_LINKS.length, Math.floor((room + gap) / pitch)))
    el.style.width = `${count * pitch - gap}px`
    // Start-aligned, then shift by half of the leftover room (measured from the real positions) so the space beside each arrow is the same.
    const arrows = box.querySelectorAll<HTMLElement>('.testbar__arrow')
    const left = el.getBoundingClientRect().left - arrows[0].getBoundingClientRect().right
    const right = arrows[1].getBoundingClientRect().left - el.getBoundingClientRect().right
    el.style.marginInlineStart = `${Math.max(0, (right - left) / 2)}px`
    measure()
  }, [measure])
  useEffect(() => {
    const el = track.current
    if (!el) return
    fit()
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', fit)
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', fit) }
  }, [fit, measure])
  // Smooth scrolling comes from CSS, which the reduced-motion rules turn off.
  const step = (dir: -1 | 1) => { const el = track.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8 }) }
  const reveal = (e: { currentTarget: Element }) => e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  const dateWords = (
    <>
      <span className="testbar__short">{dayLabel(now, position.zone)}</span>
      <span className="testbar__long">{dayLabelLong(now, position.zone)}</span>
    </>
  )
  return (
    <div className="testbar no-print" role="group" aria-label={t('testbar.label')}>
      <div className="testbar__item testbar__item--date">
        {isDemo
          ? <button type="button" className="testbar__main testbar__pick" onClick={() => setOpen(true)} aria-label={`${t('testbar.date')}: ${dayLabelLong(now, position.zone)}`}>{dateWords}</button>
          : <span className="testbar__main">{dateWords}</span>}
      </div>
      {isDemo && (
        <button type="button" className="testbar__item testbar__item--time" onClick={() => setOpen(true)} aria-label={`${t('testbar.time')}: ${clockTime(new Date(now), position.zone)}`}>
          <span className="testbar__main">{clockTime(new Date(now), position.zone)}</span>
          <span className="testbar__sub">{t(position.clock === 'ship' ? 'testbar.ship' : 'testbar.local')}</span>
        </button>
      )}
      <p className="testbar__status" aria-label={t('status.label')}>
        <Link to="/welcome" state={{ from: pathname }} className="testbar__stage testbar__stage--current" aria-current="step" aria-label={`${t('testbar.stage')}: ${stage}`}>{stage}</Link>
        {status.day !== null && <Link to="/itinerary" className="testbar__day">{t('status.day', { day: status.day })}</Link>}
        {status.where?.kind === 'sea' && <span>{t('status.sea')}</span>}
        {status.where?.kind === 'port' && (
          <span className="testbar__port">
            <Link to={`/home/ports/${status.where.id}`}>{status.where.name}</Link>
            {status.where.from && status.where.to && <span className="testbar__hours"> {t('status.hours', { from: status.where.from, to: status.where.to })}</span>}
          </span>
        )}
        {status.count && (
          <Link to="/itinerary" className="testbar__count">
            {status.count.kind === 'to' && status.count.days === 0 ? t('status.today') : status.count.kind === 'since' && status.count.days === 0 ? t('status.backToday') : t(status.count.kind === 'to' ? 'status.to' : 'status.since', { count: status.count.days })}
          </Link>
        )}
      </p>
      {menu && <div className="testbar__menu">{menu}</div>}
      <div className="testbar__carousel">
        <button type="button" className="testbar__arrow" aria-label={t('testbar.at.prev')} disabled={!edges.start} onClick={() => step(-1)}><ChevronLeft aria-hidden="true" /></button>
        <nav className="testbar__at" ref={track} aria-label={t('testbar.at.label')}>
          {AT_LINKS.map(({ to, Icon, label }) => (
            <Link key={to} to={to} className={isExplorerPath(to) ? 'testbar__at-link testbar__at-link--explorer' : 'testbar__at-link'} aria-label={t(label)} title={t(label)} aria-current={pathname === to ? 'page' : undefined} onClick={reveal} onFocus={reveal}>
              <Icon aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <button type="button" className="testbar__arrow" aria-label={t('testbar.at.next')} disabled={!edges.end} onClick={() => step(1)}><ChevronRight aria-hidden="true" /></button>
      </div>
      {isDemo && open && <PickerDialog now={now} zone={position.zone} onClose={() => setOpen(false)} />}
    </div>
  )
}

function PickerDialog({ now, zone, onClose }: { now: number; zone: string; onClose: () => void }) {
  const [date, setDate] = useState(() => new Date(now).toLocaleDateString('sv-SE', { timeZone: zone }))
  const [time, setTime] = useState(() => timeIn(now, zone))
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const apply = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) { setError(true); return }
    jumpTo(zonedToEpoch(date, time, zone))
    onClose()
    // The screen the tester was on may not fit the new stage: start again from the landing page.
    void navigate('/')
  }
  return (
    <Dialog title={t('testbar.dialog')} onClose={onClose}>
      <form className="testbar__dialog" onSubmit={apply} noValidate>
        <p>{t('testbar.dialog.note', { zone })}</p>
        <Field label={t('testbar.dialog.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label={t('testbar.dialog.time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} error={error ? t('testbar.dialog.invalid') : undefined} />
        <Button type="submit">{t('testbar.dialog.apply')}</Button>
      </form>
    </Dialog>
  )
}
