import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { t } from '../i18n'
import { hubsForStage, quickForStage } from '../routes/stageMenus'
import { routeForPath } from '../routes/nav'
import type { TabId } from '../routes/routes'

/** A tab's screens: the few guests reach most (this stage's first), then every hub (a group by what you are doing). The guest's stage decides what leads: its hubs come first and open, the rest stay below, closed. */
export function HubList({ tab, badges = {} }: { tab: TabId; badges?: Record<string, ReactNode> }) {
  const { stage } = useJourneyPosition()
  const link = (path: string) => {
    const route = routeForPath(path)
    if (!route) return null
    return <li key={path}><Link to={path}>{t(route.titleKey)}{badges[path]}</Link></li>
  }
  const quick = quickForStage(tab, stage)
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
        {hubsForStage(tab, stage).map(({ hub, lead }) => (
          <details key={hub.id} className="hub" open={lead || undefined}>
            <summary>{t(hub.labelKey)}</summary>
            <ul className="link-list">{hub.paths.map(link)}</ul>
          </details>
        ))}
      </nav>
    </>
  )
}
