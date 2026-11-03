import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useJourneyStage } from '../hooks/useJourneyStage'
import { track } from '../diagnostics/watch'
import { usePushSync } from '../hooks/usePushSync'
import { t, th } from '../i18n'
import { routeForPath, tabForPath, TABS } from '../routes/nav'
import type { TabId } from '../routes/routes'
import { areaFor, screenForPath, type TabColour } from '../routes/screens'
import { applyPageMeta, seoFor } from '../seo'
import { Chat, Help, Home, Me, Plan, Search, Ship } from './icons'
import { HelpSheet } from './HelpSheet'
import { PageHeader } from './PageHeader'
import { TestBar } from './TestBar'
import { UpdateBanner } from './UpdateBanner'

/** The colour of the five tabs as they stand until the shell moves to per-stage tabs (P4). */
const LEGACY_AREA: Record<TabId, TabColour> = { home: 'blue', plan: 'teal', ship: 'pink', chat: 'gold', me: 'plum' }

const TAB_ICONS = { home: Home, plan: Plan, ship: Ship, chat: Chat, me: Me } as const

/**
 * The app frame: skip link, top bar with the always-visible Help button, five labelled tabs (a bottom bar on phones,
 * a left rail from 1024px), and the main area. On each change of screen it updates the page title, announces the new
 * screen to screen readers, and moves focus to the main area so keyboard users start at the top of the new content.
 */
export function Shell() {
  const { pathname, state } = useLocation()
  const stage = useJourneyStage()
  const [seen, setSeen] = useState<{ path: string; area: TabColour; previous: TabColour | null } | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  usePushSync()
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)
  const activeTab = tabForPath(pathname)
  const route = routeForPath(pathname)
  const screen = route && !route.public ? screenForPath(route.path) : undefined
  const fallbackArea = LEGACY_AREA[activeTab ?? 'home']
  // The area just left carries over to a screen the stage lists under the same colour, so one area keeps its colour while the guest moves about in it.
  const previous = seen?.path === pathname ? seen.previous : (seen?.area ?? null)
  const area = screen ? areaFor(screen.id, stage, (state as { area?: unknown } | null)?.area, previous, fallbackArea) : fallbackArea
  if (seen?.path !== pathname || seen.area !== area) setSeen({ path: pathname, area, previous })
  const title = screen ? t(screen.titleKey) : route ? t(route.titleKey) : t('shell.notFound.title')

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
      <nav className="tabs no-print" aria-label={t('shell.nav')}>
        {TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id]
          const active = activeTab === tab.id
          return (
            <Link key={tab.id} to={tab.path} className="tabs__item" aria-current={active ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{t(tab.labelKey)}</span>
            </Link>
          )
        })}
      </nav>
      <UpdateBanner />
      <main id="main" ref={main} tabIndex={-1} className="shell__main">
        {screen && <PageHeader titleKey={screen.titleKey} subtextKey={screen.subtextKey} />}
        <Suspense fallback={<p role="status" className="page">{t('shell.loading')}</p>}>
          <Outlet />
        </Suspense>
      </main>
      <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
