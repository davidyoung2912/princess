import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { t } from '../i18n'
import { routeForPath, tabForPath, TABS } from '../routes/nav'
import { Chat, Help, Home, Me, Plan, Ship } from './icons'
import { HelpSheet } from './HelpSheet'

const TAB_ICONS = { home: Home, plan: Plan, ship: Ship, chat: Chat, me: Me } as const

/**
 * The app frame: skip link, top bar with the always-visible Help button, five labelled tabs (a bottom bar on phones,
 * a left rail from 1024px), and the main area. On each change of screen it updates the page title, announces the new
 * screen to screen readers, and moves focus to the main area so keyboard users start at the top of the new content.
 */
export function Shell() {
  const { pathname } = useLocation()
  const [helpOpen, setHelpOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)
  const activeTab = tabForPath(pathname)
  const route = routeForPath(pathname)
  const title = route ? t(route.titleKey) : t('shell.notFound.title')

  useEffect(() => {
    document.title = `${title} · ${t('app.name')}`
    if (first.current) { first.current = false; return }
    setAnnouncement(t('shell.announce', { title }))
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname, title])

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus() }}>{t('shell.skip')}</a>
      <header className="topbar no-print">
        <Link to="/" className="topbar__brand">{t('app.name')}</Link>
        <button type="button" className="topbar__help" onClick={() => setHelpOpen(true)}>
          <Help aria-hidden="true" />
          <span>{t('help.button')}</span>
        </button>
      </header>
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
      <main id="main" ref={main} tabIndex={-1} className="shell__main">
        <Outlet />
      </main>
      <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
