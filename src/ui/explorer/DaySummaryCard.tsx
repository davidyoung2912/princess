import type { ExplorerDay } from '../../api/explorerTypes'
import { formatTime } from '../../domain/cruise'
import { summariseDay, summaryLines } from '../../domain/explorer/daySummary'
import type { ExplorerKind } from '../../domain/explorer/types'
import type { ExplorerDayState } from '../../hooks/useExplorer'
import { t } from '../../i18n'
import type { StringKey } from '../../i18n'
import { Card } from '../Card'
import { StanleyPose } from '../StanleyPose'
import { EXPLORER_POSE } from './venueArt'

/** The card at the top of an Explorer: what the chosen day holds, in that Explorer's own words (hours now, what is next, what is on your plan). The page header already says what the Explorer is. */
export function DaySummaryCard({ kind, data, state }: { kind: ExplorerKind; data: ExplorerDay; state: ExplorerDayState }) {
  const lines = summaryLines(kind, summariseDay(data, { currentDay: state.currentDay, now: state.now, nowAt: state.nowAt }), data.day, formatTime)
  if (lines.length === 0) return null
  return (
    <Card hero labelledBy="exp-sum-h">
      <span className="landing-pose calm-hide"><StanleyPose pose={EXPLORER_POSE[kind]} size={72} /></span>
      <h2 id="exp-sum-h" className="card__title">{t('exp.sum.title')}</h2>
      <ul className="exp-sum">
        {lines.map((l) => <li key={l.key}>{t(`exp.sum.${l.key}` as StringKey, l.params)}</li>)}
      </ul>
    </Card>
  )
}
