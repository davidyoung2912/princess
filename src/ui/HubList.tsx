import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { useJourneyStage } from '../hooks/useJourneyStage'
import { t } from '../i18n'
import { hubsOf, QUICK } from '../routes/hubs'
import { routeForPath } from '../routes/nav'
import type { TabId } from '../routes/routes'

/** A tab's screens: the few guests reach most, then every hub (a group by what you are doing), the one for the guest's stage already open. */
export function HubList({ tab, badges = {} }: { tab: TabId; badges?: Record<string, ReactNode> }) {
  const stage = useJourneyStage()
  const link = (path: string) => {
    const route = routeForPath(path)
    if (!route) return null
    return <li key={path}><Link to={path}>{t(route.titleKey)}{badges[path]}</Link></li>
  }
  const quick = QUICK[tab]
  return (
    <>
      {quick.length > 0 && (
        <nav aria-labelledby={`${tab}-quick-h`}>
          <h2 id={`${tab}-quick-h`}>{t('hub.quick')}</h2>
          <ul className="link-list">{quick.map(link)}</ul>
        </nav>
      )}
      <nav aria-labelledby={`${tab}-hubs-h`}>
        <h2 id={`${tab}-hubs-h`}>{t('hub.all')}</h2>
        {hubsOf(tab).map((hub) => (
          <details key={hub.id} className="hub" open={hub.stage === stage || undefined}>
            <summary>{t(hub.labelKey)}</summary>
            <ul className="link-list">{hub.paths.map(link)}</ul>
          </details>
        ))}
      </nav>
    </>
  )
}
