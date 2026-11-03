import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { getContext, subscribeContext } from '../account/context'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { track } from '../diagnostics/watch'
import { usePushSync } from '../hooks/usePushSync'
import { t, th } from '../i18n'
import { routeForPath } from '../routes/nav'
import { screenForPath, type TabColour } from '../routes/screens'
import { accessAt, activeTabKey, areaAt, navTabs, tabAtPath } from '../routes/stageNav'
import { applyPageMeta, seoFor } from '../seo'
import { Ask, Cabin, Chat, Compass, DoorOpen, Help, Home, HeartPulse, ClipboardList, Images, MapPin, Me, Plan, Plane, QrCode, Search, Ship, Sparkles, Star, Sun, Ticket, Trip, Users, Wallet, Anchor } from './icons'
import { HelpSheet } from './HelpSheet'
import { PageHeader } from './PageHeader'
import { TestBar } from './TestBar'
import { UpdateBanner } from './UpdateBanner'

/** One icon per tab name, the same at every stage a tab appears in. */
const TAB_ICONS: Record<string, typeof Home> = {
  home: Home, me: Me, plan: Plan, ship: Ship, explore: Compass, ask: Ask, sailing: Anchor, cabin: Cabin, cost: Wallet, booking: Ticket, travellers: Users,
  pay: Wallet, trip: Trip, needs: HeartPulse, group: Users, prepare: ClipboardList, board: QrCode, travel: Plane, today: Sun, people: Users, port: MapPin,
  leave: DoorOpen, memories: Images, next: Sparkles, feedback: Star,
}
const FALLBACK_ICON = Chat

/**
 * The app frame: skip link, top bar with the always-visible Help button, the stage's tabs (Home, two or three of its own, Me; a bottom bar on phones,
 * a left rail from 1024px), and the main area. An address the stage does not use goes Home. On each change of screen it updates the page title, announces the new
 * screen to screen readers, and moves focus to the main area so keyboard users start at the top of the new content.
 */
export function Shell() {
  const { pathname, state } = useLocation()
  const { stage } = useJourneyPosition()
  const known = useSyncExternalStore(subscribeContext, getContext, getContext) !== null
  const [seen, setSeen] = useState<{ path: string; area: TabColour; previous: TabColour | null } | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  usePushSync()
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)
  const route = routeForPath(pathname)
  const screen = route && !route.public ? screenForPath(route.path) : undefined
  const landing = tabAtPath(pathname, stage)
  const tabs = navTabs(stage)
  // Until the server has said which stage the guest is in, the stage is a guess; a stale address is only judged once it is known.
  const stale = known && !!route && !route.public && accessAt(route.path, pathname, stage) === 'home'
  const fallbackArea: TabColour = 'blue'
  // The area just left carries over to a screen the stage lists under the same colour, so one area keeps its colour while the guest moves about in it.
  const previous = seen?.path === pathname ? seen.previous : (seen?.area ?? null)
  const area = areaAt(pathname, route?.path ?? null, stage, (state as { area?: unknown } | null)?.area, previous, fallbackArea)
  if (seen?.path !== pathname || seen.area !== area) setSeen({ path: pathname, area, previous })
  const title = landing ? landing.label : screen ? t(screen.titleKey) : route ? t(route.titleKey) : t('shell.notFound.title')

  useEffect(() => {
    const seo = seoFor(route?.path)
    const full = `${title} · ${t('app.name')}`
    applyPageMeta(document, { title: full, description: t(seo?.description ?? 'seo.private'), indexable: !!seo, url: `${window.location.origin}${pathname}` })
    track('screen', route?.path)
    if (first.current) { first.current = false; return }
    setAnnouncement(t('shell.announce', { title }))
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname, title, route?.path])

  if (stale) return <Navigate to="/" replace />
  const activeKey = landing || (screen && screen.family !== 'X') ? activeTabKey(pathname, stage, area) : null

  return (
    <div className="shell" data-area={area}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus() }}>{t('shell.skip')}</a>
      <div className="shell__top">
        <header className="topbar no-print">
          <Link to="/" className="topbar__brand">{t('app.name')}</Link>
          <Link to="/ship/search" className="topbar__search">
            <Search aria-hidden="true" />
            <span>{t('shell.search')}</span>
          </Link>
          <button type="button" className="topbar__help" onClick={() => setHelpOpen(true)}>
            <Help aria-hidden="true" />
            <span>{th('help.button')}</span>
          </button>
        </header>
        <TestBar />
      </div>
      <nav className="tabs no-print" aria-label={t('shell.nav')} style={{ '--tab-count': tabs.length } as CSSProperties}>
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.key] ?? FALLBACK_ICON
          const active = activeKey === tab.key
          return (
            <Link key={tab.key} to={tab.path} data-colour={tab.colour} className="tabs__item" aria-current={active ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{tab.key === 'home' ? t('tab.home') : tab.key === 'me' ? t('tab.me') : tab.label}</span>
            </Link>
          )
        })}
      </nav>
      <UpdateBanner />
      <main id="main" ref={main} tabIndex={-1} className="shell__main">
        {landing ? <PageHeader title={landing.label} subtext={landing.subtext} /> : screen ? <PageHeader titleKey={screen.titleKey} subtextKey={screen.subtextKey} /> : route && !route.public && route.path !== '/kit' && <PageHeader title={t(route.titleKey)} />}
        <Suspense fallback={<p role="status" className="page">{t('shell.loading')}</p>}>
          <Outlet />
        </Suspense>
      </main>
      <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
