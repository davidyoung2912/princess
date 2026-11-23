import { useId, useState } from 'react'
import { normalizeAction, type ActionContext, type StanleyAction } from '../logic/stanleyAction'
import { defaultLeadMin, LEAD_CHOICES, remindMeArgs, type RemindAnchor } from '../logic/stanleyReminders'
import { t } from '../../../shared/i18n'
import { stanleyActions } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { StanleyActionCard } from './StanleyActionCard'

/**
 * Remind me (phase P2a, REM-C06): one control on a plan item or on all aboard. It asks the server for a preview of a reminder that follows the item, with the default lead for its kind and a choice of others.
 * Nothing is set until the card that comes back is confirmed, and the reminder moves with the item if the item moves.
 */
export function RemindMe({ anchor, label, date, context }: { anchor: RemindAnchor; label: string; date?: string; context: ActionContext }) {
  const selectId = useId()
  const [lead, setLead] = useState(defaultLeadMin(anchor.kind === 'allAboard' ? 'allAboard' : 'plan'))
  const [prepared, setPrepared] = useState<StanleyAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const ask = async () => {
    setBusy(true); setFailed(false)
    try {
      const a = normalizeAction(await stanleyActions.prepare({ kind: 'remind_me', args: remindMeArgs(anchor, lead, label, date), context }))
      setPrepared(a)
      setFailed(a === null)
    } catch { setFailed(true) }
    setBusy(false)
  }

  return (
    <span className="remind-me">
      {prepared === null && (
        <>
          <label htmlFor={selectId} className="visually-hidden">{t('remindMe.lead', { title: label })}</label>
          <select id={selectId} className="field__input" value={lead} onChange={(e) => setLead(Number(e.target.value))}>
            {[...new Set([...LEAD_CHOICES, lead])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{t('remindMe.minutesBefore', { count: m })}</option>)}
          </select>
          <Button variant="tertiary" disabled={busy} aria-label={t('remindMe.aria', { title: label })} onClick={() => { void ask() }}>{t('remindMe.button')}</Button>
        </>
      )}
      {failed && <span role="alert" className="field__error"> {t('remindMe.failed')}</span>}
      {prepared && <span role="status" className="remind-me__card"><StanleyActionCard action={prepared} onChange={setPrepared} /></span>}
    </span>
  )
}
