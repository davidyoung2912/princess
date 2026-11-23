import type { ExplorerDay } from '../../api/explorerTypes'
import { formatTime } from '../../domain/cruise'
import { summariseDay, summaryLines } from '../../domain/explorer/daySummary'
import type { ExplorerKind } from '../../domain/explorer/types'
import type { ExplorerDayState } from '../../hooks/useExplorer'
import { t, headingCase } from '../../i18n'
import type { StringKey } from '../../i18n'
import { Card } from '../Card'
import { useSailing } from '../../hooks/useDemo'
import { itinerary, shipZoneOnDate } from '../../domain/sailings'
import { scheduleStatus } from '../../domain/explorer/scheduleStatus'
import { clockTime } from '../../domain/syncAge'

/** The card at the top of an Explorer: what the chosen day holds, in that Explorer's own words (hours now, what is next, what is on your plan). The page header already says what the Explorer is. */
export function DaySummaryCard({ kind, data, state }: { kind: ExplorerKind; data: ExplorerDay; state: ExplorerDayState }) {
  const sailing = useSailing()
  const date = itinerary(sailing)[data.day - 1]?.date
  const zone = date ? shipZoneOnDate(sailing, date) : null
  const facts = date && zone ? scheduleStatus(date, zone, state.nowAt) : null
  const lines = summaryLines(kind, summariseDay(data, { currentDay: state.currentDay, now: state.now, nowAt: state.nowAt }), data.day, formatTime)
  if (lines.length === 0 && (!facts || facts.status === 'past')) return null
  return (
    <Card hero labelledBy="exp-sum-h">
      <h2 id="exp-sum-h" className="card__title">{headingCase(t('exp.sum.title'))}</h2>
      <ul className="exp-sum">
        {lines.map((l) => <li key={l.key}>{t(`exp.sum.${l.key}` as StringKey, l.params)}</li>)}
      </ul>
      {facts && facts.status !== 'past' && (
        <p className="muted" role="status">{facts.status === 'final' ? t('exp.sched.final') : t('exp.sched.preliminary', { time: clockTime(new Date(facts.finalAt), zone ?? undefined) })}</p>
      )}
    </Card>
  )
}
