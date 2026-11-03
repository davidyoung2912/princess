import { useLocation } from 'react-router'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { tabAtPath } from '../routes/stageNav'
import { TabScreens } from './TabScreens'

/** The landing page of a stage tab that has no screen of its own: the header (drawn by the shell) and the tab's screens in priority order. */
export function TabLanding() {
  const { pathname } = useLocation()
  const { stage } = useJourneyPosition()
  const tab = tabAtPath(pathname, stage)
  return <div className="page">{tab && <TabScreens tabKey={tab.key} />}</div>
}
