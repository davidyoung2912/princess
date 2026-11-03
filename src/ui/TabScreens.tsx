import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { th } from '../i18n'
import { navTabs, splitMe, tabScreenIds } from '../routes/stageNav'
import type { ReactNode } from 'react'
import { ScreenList } from './ScreenList'

/** The list of screens a tab holds at the guest's stage, in the stage's order. Me shows its Settings and help as a second group. Renders nothing for a tab the stage does not have. */
export function TabScreens({ tabKey, badges }: { tabKey: string; badges?: Record<string, ReactNode> }) {
  const { stage } = useJourneyPosition()
  const tab = navTabs(stage).find((x) => x.key === tabKey)
  if (!tab) return null
  const ids = tabScreenIds(tab, stage)
  if (tab.kind === 'me') {
    const { main, settings } = splitMe(ids)
    return (
      <>
        <ScreenList ids={main} colour={tab.colour} badges={badges} headingId="me-list-h" heading={th('tabs.me.yours')} />
        <ScreenList ids={settings} colour={tab.colour} badges={badges} headingId="me-settings-h" heading={th('tabs.me.settings')} />
      </>
    )
  }
  return <ScreenList ids={ids} colour={tab.colour} badges={badges} headingId={`${tab.key}-list-h`} />
}
