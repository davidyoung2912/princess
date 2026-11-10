import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { addCustom, removeCustom } from '../../data/customReminders'
import { canConfirm, canUndo, changeForAction, changeIdFor, newKey, normalizeAction, planSnapshot, problemOf, reminderForAction, type ConfirmProblem, type StanleyAction } from '../../ai/stanleyAction'
import { formatMoney } from '../../domain/money'
import { acceptChange, addProposal, undoChange } from '../../domain/planChange'
import { itinerary, shipZoneOnDate } from '../../domain/sailings'
import { zonedToEpoch } from '../../domain/timezones'
import { useDayPlan, useCurrentDay } from '../../hooks/useDayPlan'
import { useNow } from '../../hooks/useDemo'
import { usePilot } from '../../hooks/usePilot'
import { programmeFollows } from '../../pilot/programme'
import { t, th, type StringKey } from '../../i18n'
import { api, stanleyActions } from '../../runtime'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { useShipTime } from '../onboard/shipTime'

/** The words for each way a confirm or an undo can be refused. */
const PROBLEM: Record<ConfirmProblem, StringKey> = { expired: 'action.expired', changed: 'action.changed', off: 'action.off', forbidden: 'action.forbidden', tooLate: 'action.tooLate', other: 'action.other' }

/** Where the receipt can be found again, by kind of action. */
const WHERE: Partial<Record<StanleyAction['kind'], { path: string; label: StringKey }>> = {
  order_item: { path: '/ship/requests', label: 'action.go.requests' },
  add_excursion: { path: '/plan/excursions', label: 'action.go.excursions' },
  move_dinner: { path: '/plan/dining', label: 'action.go.dining' },
  reserve_dinner: { path: '/plan/dining', label: 'action.go.dining' },
  draft_case: { path: '/me/cases', label: 'action.go.cases' },
  plan_change: { path: '/plan/autopilot', label: 'action.go.changes' },
  change_seating: { path: '/plan/dining', label: 'action.go.dining' },
}

/**
 * A change Stanley has prepared (phase 5): the exact items, who is affected, any price, the cancellation terms and how long the preview is good for. Nothing has happened until the guest presses Confirm.
 * Confirm sends the preview's id with a key made once for this card, so a double tap or a retry cannot do it twice; the server checks again that it has not expired and that the price and availability are
 * what is shown. Then the receipt shows, with an Undo for two hours. A day-plan change and a reminder are applied here from the confirmed receipt, because those live on this device.
 */
export function StanleyActionCard({ action, onChange, onNavigate }: { action: StanleyAction; onChange: (next: StanleyAction) => void; onNavigate?: () => void }) {
  const now = useNow()
  const time = useShipTime()
  const currentDay = useCurrentDay()
  // Only a plan change names a day of the plan; everything else is about today.
  const day = action.kind === 'plan_change' && Number(action.params.day) >= 1 ? Number(action.params.day) : currentDay
  const dp = useDayPlan(day)
  const { state: pilot, update } = usePilot()
  const key = useRef(newKey())
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [notice, setNotice] = useState<StringKey | null>(null)

  const context = { plan: planSnapshot(dp.rows, dp.alternatives, day), sailingId: dp.sailing.id }

  /** What the device does for a device action once the server has confirmed it. Returns false when the plan no longer allows it. */
  const applyHere = (a: StanleyAction): boolean => {
    if (a.kind === 'plan_change') {
      const change = changeForAction(a, dp.rows, dp.alternatives, now)
      if (!change) return false
      const r = acceptChange(dp.base, addProposal(dp.changes, change), change.id, now)
      if (!r.ok) return false
      void programmeFollows(api.onboard, dp.sailing, pilot.prefs, dp.changes, r.changes.filter((c) => c.day === day))
      update((s) => ({ ...s, changes: [...s.changes.filter((c) => c.day !== day), ...r.changes] }))
      return true
    }
    if (a.kind === 'remind_me') {
      const date = itinerary(dp.sailing)[currentDay - 1]?.date
      const due = date ? zonedToEpoch(date, a.params.at ?? '', shipZoneOnDate(dp.sailing, date)) : null
      const reminder = reminderForAction(a, due)
      if (!reminder) return false
      addCustom(reminder)
      return true
    }
    return true
  }

  const settle = async (a: StanleyAction) => {
    if (a.status === 'done' && a.onDevice && !applyHere(a)) {
      // The server has recorded it, but the plan on this phone no longer allows it, so it is undone rather than left half done.
      try { onChange(normalizeAction(await stanleyActions.undo(a.id, context)) ?? a) } catch { onChange(a) }
      setNotice('action.deviceClash')
      return
    }
    onChange(a)
  }

  const confirm = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const next = normalizeAction(await stanleyActions.confirm(action.id, key.current, context))
      if (next) await settle(next)
      else setNotice('action.other')
    } catch (e) {
      const p = problemOf(e instanceof Error ? e.message : '')
      if (p === 'expired' || p === 'changed') onChange({ ...action, status: p })
      else setNotice(PROBLEM[p])
    }
    setBusy(false)
  }

  const check = async () => {
    setBusy(true)
    try {
      const next = normalizeAction(await stanleyActions.get(action.id))
      if (next) await settle(next)
    } catch { setNotice('action.other') }
    setBusy(false)
  }

  const undo = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const next = normalizeAction(await stanleyActions.undo(action.id, context))
      if (next) {
        if (action.kind === 'plan_change') update((s) => ({ ...s, changes: undoChange(s.changes, changeIdFor(action), now) }))
        if (action.kind === 'remind_me') removeCustom(action.id)
        onChange(next)
        setNotice('action.undone')
      }
    } catch (e) {
      setNotice(PROBLEM[problemOf(e instanceof Error ? e.message : '')])
    }
    setBusy(false)
  }

  const where = WHERE[action.kind]
  const preview = action.status === 'prepared' && !dismissed
  return (
    <Card labelledBy={`act-${action.id}`}>
      <h2 id={`act-${action.id}`} className="card__title">{preview ? th('action.check') : th('action.title')}</h2>
      <p><strong>{action.title}</strong></p>
      {action.lines.length > 0 && <ul className="plain-list">{action.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {action.who.length > 0 && <p>{t('action.who', { who: action.who.join(', ') })}</p>}
      {action.cents !== null && <p>{t('action.price', { amount: formatMoney(action.cents) })}</p>}
      {action.terms && <p className="muted">{action.terms}</p>}
      {preview && (
        <>
          <p className="muted">{canConfirm(action, now) ? t('action.expires', { time: time(action.expiresAt) }) : t('action.expired')}</p>
          <div className="button-row">
            <Button onClick={() => void confirm()} disabled={busy || !canConfirm(action, now)}>{t('action.confirm')}</Button>
            <Button variant="secondary" onClick={() => setDismissed(true)} disabled={busy}>{t('action.cancel')}</Button>
          </div>
        </>
      )}
      {action.status === 'prepared' && dismissed && <Banner kind="info" title={t('action.dismissed')} />}
      {action.status === 'done' && (
        <Banner kind="success" title={t(action.onDevice ? 'action.doneDevice' : 'action.done', { receipt: action.receipt ?? '' })}>
          {canUndo(action, now) && <p className="muted">{t('action.undoUntil', { time: time(action.undoUntil ?? now) })}</p>}
          {where && <p><Link to={where.path} onClick={onNavigate}>{t(where.label)}</Link></p>}
        </Banner>
      )}
      {action.status === 'done' && canUndo(action, now) && <Button variant="secondary" onClick={() => void undo()} disabled={busy}>{t('action.undo')}</Button>}
      {action.status === 'undone' && <Banner kind="info" title={t('action.undone')} />}
      {action.status === 'failed' && <Banner kind="warning" title={t('action.failed')}><p>{t(`action.reason.${action.reason ?? 'other'}` as StringKey)}</p></Banner>}
      {(action.status === 'pending' || action.status === 'executing') && (
        <Banner kind="info" title={t('action.pending')} action={<Button variant="secondary" onClick={() => void check()} disabled={busy}>{t('action.checkAgain')}</Button>} />
      )}
      {action.status === 'expired' && <Banner kind="info" title={t('action.expired')} />}
      {action.status === 'changed' && <Banner kind="warning" title={t('action.changed')} />}
      {notice && notice !== 'action.undone' && <p role="alert" className="field__error">{t(notice)}</p>}
    </Card>
  )
}
