import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import logo from '../assets/princess.png'
import stanley from '../assets/stanley-small.png'
import { Link, Navigate, Outlet, useLocation, useNavigationType } from 'react-router'
import { getContext, subscribeContext } from '../account/context'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { track } from '../diagnostics/watch'
import { usePushSync } from '../hooks/usePushSync'
import { t, th } from '../i18n'
import { routeForPath } from '../routes/nav'
import { recordVisit } from '../routes/trail'
import { screenForPath, type TabColour } from '../routes/screens'
import { accessAt, activeTabKey, areaAt, earlierAt, navTabs, tabAtPath } from '../routes/stageNav'
import { applyPageMeta, seoFor } from '../seo'
import { Help, Search } from './icons'
import { SCREEN_ICONS } from './screenIcons'
import { FALLBACK_ICON, TAB_ICONS } from './tabIcons'
import { HelpSheet } from './HelpSheet'
import { StanleyDialog } from './ai/StanleyDialog'
import { PageHeader } from './PageHeader'
import { tabText } from './tabText'
import { TestBar } from './TestBar'
import { UpdateBanner } from './UpdateBanner'


/**
 * The app frame: skip link, top bar with the always-visible Help button, the stage's tabs (Home, two or three of its own, Me; a bottom bar on phones,
 * a left rail from 1024px), and the main area. An address the stage does not use goes Home. On each change of screen it updates the page title, announces the new
 * screen to screen readers, and moves focus to the main area so keyboard users start at the top of the new content.
 */
export function Shell() {
  const { pathname, search, state } = useLocation()
  const navigationType = useNavigationType()
  const { stage } = useJourneyPosition()
  const known = useSyncExternalStore(subscribeContext, getContext, getContext) !== null
  const [seen, setSeen] = useState<{ path: string; area: TabColour; previous: TabColour | null } | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [stanleyOpen, setStanleyOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  usePushSync()
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)
  const route = routeForPath(pathname)
  const screen = route && !route.public ? screenForPath(route.path) : undefined
  const landing = tabAtPath(pathname, stage)
  const tabs = navTabs(stage)
  // Until the server has said which stage the guest is in, the stage is a guess; a stale address is only judged once it is known.
  // A screen of an earlier stage opens when the guest chose it from a search result ("From your trip"); typed or refreshed, it is stale.
  const fromSearch = (state as { earlier?: unknown } | null)?.earlier === true && !!route && earlierAt(route.path, stage)
  const stale = known && !!route && !route.public && !fromSearch && accessAt(route.path, pathname, stage) === 'home'
  const fallbackArea: TabColour = 'blue'
  // The area just left carries over to a screen the stage lists under the same colour, so one area keeps its colour while the guest moves about in it.
  const previous = seen?.path === pathname ? seen.previous : (seen?.area ?? null)
  const area = areaAt(pathname, route?.path ?? null, stage, (state as { area?: unknown } | null)?.area, previous, fallbackArea)
  if (seen?.path !== pathname || seen.area !== area) setSeen({ path: pathname, area, previous })
  const landingWords = landing ? tabText(landing, stage) : null
  const title = landingWords ? landingWords.label : screen ? t(screen.titleKey) : route ? t(route.titleKey) : t('shell.notFound.title')

  useEffect(() => { recordVisit(pathname + search, navigationType) }, [pathname, search, navigationType])

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
  // The header wears its own screen's icon where there is a good one, otherwise the icon of the tab the screen belongs to.
  const headerIcon = (!landing && screen ? SCREEN_ICONS[screen.id] : undefined) ?? (activeKey ? (TAB_ICONS[activeKey] ?? FALLBACK_ICON) : undefined)

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
          <button type="button" className="topbar__stanley" onClick={() => setStanleyOpen(true)} aria-label={t('stanley.button')}>
            <img src={stanley} alt="" width="192" height="192" />
          </button>
          <button type="button" className="topbar__help" onClick={() => setHelpOpen(true)}>
            <Help aria-hidden="true" />
            <span>{th('help.button')}</span>
          </button>
          <Link to="/account" className="topbar__logo" aria-label={t('account.logo')}>
            <img src={logo} alt="" width="1024" height="1024" />
          </Link>
        </header>
        <TestBar />
      </div>
      <nav className="tabs no-print" aria-label={t('shell.nav')} style={{ '--tab-count': tabs.length } as CSSProperties}>
        <Link to="/account" className="tabs__logo" aria-label={t('account.logo')}>
          <img src={logo} alt="" width="1024" height="1024" />
        </Link>
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.key] ?? FALLBACK_ICON
          const active = activeKey === tab.key
          return (
            <Link key={tab.key} to={tab.path} data-colour={tab.colour} className="tabs__item" aria-current={active ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{tabText(tab, stage).label}</span>
            </Link>
          )
        })}
        <Link to="/ship/search" className="tabs__search">
          <Search aria-hidden="true" />
          <span>{t('shell.search')}</span>
        </Link>
        <button type="button" className="tabs__stanley" onClick={() => setStanleyOpen(true)}>
          <img src={stanley} alt="" width="192" height="192" />
          <span>{th('stanley.button')}</span>
        </button>
        <button type="button" className="tabs__help" onClick={() => setHelpOpen(true)}>
          <Help aria-hidden="true" />
          <span>{th('help.button')}</span>
        </button>
      </nav>
      <UpdateBanner />
      <main id="main" ref={main} tabIndex={-1} className="shell__main">
        {landingWords ? <PageHeader title={landingWords.label} subtext={landingWords.subtext} icon={headerIcon} /> : screen ? <PageHeader titleKey={screen.titleKey} subtextKey={screen.subtextKey} icon={headerIcon} back /> : route && !route.public && route.path !== '/kit' && <PageHeader title={t(route.titleKey)} icon={headerIcon} back />}
        <Suspense fallback={<p role="status" className="page">{t('shell.loading')}</p>}>
          <Outlet />
        </Suspense>
      </main>
      <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
      {stanleyOpen && <StanleyDialog onClose={() => setStanleyOpen(false)} />}
    </div>
  )
}
