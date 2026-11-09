import { useEffect } from 'react'
import type { Countdown } from '../../domain/countdowns'
import { earlierDates, noteDeadlines } from '../../domain/deadlineLog'
import { formatDate } from '../../domain/cruise'
import { useNow } from '../../hooks/useDemo'
import { usePilot } from '../../hooks/usePilot'
import { t, type StringKey } from '../../i18n'

/** Where each deadline's date comes from and which time zone it is in, plus any earlier date it replaced (MNG-15). A moved deadline is a new event; the old one stays on record. */
export function DeadlineNotes({ counts }: { counts: readonly Countdown[] }) {
  const { state, update } = usePilot()
  const now = useNow()
  const key = counts.map((c) => `${c.id}:${c.date}`).join('|')
  useEffect(() => {
    if (counts.length === 0) return
    update((s) => {
      const next = noteDeadlines(s.deadlines, counts.map((c) => ({ id: c.id, date: c.date })), now)
      return next.length === s.deadlines.length && next.every((e, i) => e === s.deadlines[i]) ? s : { ...s, deadlines: next }
    })
    // Only a different set of dates is worth noting; `now` moving on is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (counts.length === 0) return null
  return (
    <details className="calm-hide">
      <summary>{t('count.details')}</summary>
      <ul className="plain-list">
        {counts.map((c) => (
          <li key={c.id}>
            {t(`count.name.${c.id}` as StringKey)}: {formatDate(c.date)} · {t('count.zone', { zone: c.zone.replace(/^.*\//, '').replace(/_/g, ' ') })} · {t(`count.source.${c.source}` as StringKey)}
            {earlierDates(state.deadlines, c.id).map((e) => <span key={e.seenAt} className="muted"> · {t('count.was', { date: formatDate(e.date) })}</span>)}
          </li>
        ))}
      </ul>
    </details>
  )
}
