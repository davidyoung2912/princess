import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { th } from '../i18n'
import { groupShip, navTabs, splitMe, tabScreenIds } from '../routes/stageNav'
import type { ReactNode } from 'react'
import { ScreenList } from './ScreenList'
import { useTileLive } from '../hooks/useTileLive'
import { usePartyOrder } from '../hooks/usePartyOrder'
import { SCREEN_BY_ID } from '../routes/screens'

/** The list of screens a tab holds at the guest's stage, in the stage's order. Me shows its Settings and help as a second group. Renders nothing for a tab the stage does not have. */
export function TabScreens({ tabKey, badges }: { tabKey: string; badges?: Record<string, ReactNode> }) {
  const { stage } = useJourneyPosition()
  const tab = navTabs(stage).find((x) => x.key === tabKey)
  const ids = tab ? tabScreenIds(tab, stage) : []
  const live = useTileLive(ids.map((id) => SCREEN_BY_ID.get(id)?.path ?? ''), tab !== undefined)
  const { order, forYou } = usePartyOrder(tab !== undefined && tab.kind !== 'me')
  if (!tab) return null
  if (tab.kind === 'me') {
    const { main, settings } = splitMe(ids)
    return (
      <>
        <ScreenList ids={main} colour={tab.colour} badges={badges} live={live} headingId="me-list-h" heading={th('tabs.me.yours')} />
        <ScreenList ids={settings} colour={tab.colour} badges={badges} live={live} headingId="me-settings-h" heading={th('tabs.me.settings')} />
      </>
    )
  }
  const mine = forYou(ids)
  const rest = ids.filter((id) => !mine.includes(id))
  const forYouList = mine.length > 0 ? <ScreenList ids={mine} colour={tab.colour} badges={badges} live={live} headingId={`${tab.key}-foryou-h`} heading={th('tabs.forYou')} /> : null
  if (tab.key === 'ship') {
    return <>{forYouList}{groupShip(rest).map((g) => <ScreenList key={g.group ?? 'rest'} ids={order(g.ids)} colour={tab.colour} badges={badges} live={live} headingId={`ship-${g.group ?? 'rest'}-h`} heading={g.group ? th(`tabs.ship.${g.group}`) : undefined} />)}</>
  }
  return <>{forYouList}<ScreenList ids={order(rest)} colour={tab.colour} badges={badges} live={live} headingId={`${tab.key}-list-h`} /></>
}
