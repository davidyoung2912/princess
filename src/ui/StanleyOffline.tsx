import { useEffect, useRef, useState } from 'react'
import { catchUpCard, offlineFirings, outcomeOf, splitQueue, type CatchUpLine } from '../ai/stanleyOffline'
import { problemOf } from '../ai/stanleyAction'
import { isApiError } from '../api/errors'
import { loadQueue, loadReminderCopy, loadShown, markShown, saveQueue } from '../data/stanleyOffline'
import { useNow } from '../hooks/useDemo'
import { useOnline } from '../hooks/useOnline'
import { t, type StringKey } from '../i18n'
import { stanleyActions } from '../runtime'
import { Banner } from './Banner'
import { Button } from './Button'
import { useShipTime } from './onboard/shipTime'

/** Reminders from the copy on this phone that came due while it was offline or closed, with their true times (AC-R10-01). Each shows once. */
export function OfflineFirings() {
  const now = useNow()
  const time = useShipTime()
  const [shown, setShown] = useState(loadShown)
  const due = offlineFirings(loadReminderCopy(), now, shown)
  if (due.length === 0) return null
  return (
    <section aria-label={t('reminders.label')} className="local-reminders">
      {due.map((f) => (
        <Banner key={f.id} kind="info" title={f.text} action={<Button variant="secondary" onClick={() => setShown(markShown([f.id]))}>{t('stanleyOffline.dismiss')}</Button>}>
          <p>{f.late ? t('stanleyOffline.firingLate', { due: time(f.dueAt), now: time(f.shownAt) }) : t('stanleyOffline.firingOnTime', { due: time(f.dueAt) })}</p>
          {f.mayHaveMoved && <p>{t('stanleyOffline.mayHaveMoved', { checked: time(f.checkedAt) })}</p>}
        </Banner>
      ))}
    </section>
  )
}

/** On reconnect, sends each waiting confirm back to the server, which checks it again; the guest sees what happened in one card. A queued confirm is never treated as done until the server says so. */
export function CatchUp() {
  const online = useOnline()
  const [lines, setLines] = useState<CatchUpLine[]>([])
  const running = useRef(false)
  useEffect(() => {
    if (!online || running.current) return
    const queue = loadQueue()
    if (queue.length === 0) return
    running.current = true
    void (async () => {
      const { waiting, expired } = splitQueue(queue, Date.now())
      const out: CatchUpLine[] = expired.map((q) => ({ actionId: q.actionId, title: q.title, outcome: 'expired' }))
      for (const q of waiting) {
        try {
          const a = await stanleyActions.confirm(q.actionId, q.key)
          out.push({ actionId: q.actionId, title: q.title, outcome: (a as { status?: unknown } | null)?.status === 'done' ? 'done' : 'refused' })
        } catch (e) {
          if (!isApiError(e) || e.retryable) { running.current = false; saveQueue([...waiting.slice(waiting.indexOf(q))]); setLines(catchUpCard(out)); return }
          out.push({ actionId: q.actionId, title: q.title, outcome: outcomeOf(problemOf(e.message)) })
        }
      }
      saveQueue([])
      setLines(catchUpCard(out))
      running.current = false
    })()
  }, [online])
  if (lines.length === 0) return null
  return (
    <section aria-label={t('stanleyOffline.catchUp')} className="local-reminders">
      <Banner kind="info" title={t('stanleyOffline.catchUp')} action={<Button variant="secondary" onClick={() => setLines([])}>{t('stanleyOffline.dismiss')}</Button>}>
        <ul className="plain-list">{lines.map((l) => <li key={l.actionId}>{t(`stanleyOffline.outcome.${l.outcome}` as StringKey, { title: l.title })}</li>)}</ul>
      </Banner>
    </section>
  )
}
