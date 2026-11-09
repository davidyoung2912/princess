import { useMemo } from 'react'
import type { JourneyStage } from '../routes/hubs'
import { SCREEN_BY_ID } from '../routes/screens'
import { navTabs, tabScreenIds } from '../routes/stageNav'
import { alertPaths, tabsNeedingAttention } from '../domain/tileLive'
import { useTileLive } from './useTileLive'

/** The keys of the tabs that hold something urgent (an overdue balance, a drill due, a child not seen), for a dot on the tab bar. Loads only what those few lines need. */
export function useTabAlerts(stage: JourneyStage, enabled: boolean): ReadonlySet<string> {
  const tabs = useMemo(() => navTabs(stage).map((tab) => ({ key: tab.key, paths: alertPaths(tabScreenIds(tab, stage).map((id) => SCREEN_BY_ID.get(id)?.path ?? '')) })), [stage])
  const live = useTileLive(tabs.flatMap((x) => x.paths), enabled)
  return tabsNeedingAttention(tabs, live)
}
