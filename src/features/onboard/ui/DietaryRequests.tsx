import { useState } from 'react'
import type { Reservation } from '../../../shared/api/types'
import { canSendDietary, DIETARY_BADGE, DIETARY_KINDS, DIETARY_NOTE_MAX, DIETARY_STATUS_HELP, DIETARY_STATUS_LABEL, type DietaryKind } from '../../../domain/dietaryRequest'
import { useAction } from '../../../shared/hooks/useAction'
import { t, th } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { TextArea } from '../../../shared/ui/Field'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { PlanError } from '../../plan/ui/common'
import { names } from '../../plan/ui/people'
import { api } from '../../../app/runtime'

/** Special-diet and allergy requests on one reservation, with the restaurant's answer for each (DIN-110..112, 119..120). The status always comes from the dining operation. */
export function DietaryRequests({ r, canEdit, reload }: { r: Reservation; canEdit: boolean; reload: () => void }) {
  const requests = r.requests ?? []
  const [guest, setGuest] = useState(r.guests[0] ?? '')
  const [kind, setKind] = useState<DietaryKind>('allergy')
  const [note, setNote] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const send = useAction(async () => { await api.plan.dining.setDietary(r.id, { guest, kind, note: note.trim(), acknowledged }); setNote(''); setAcknowledged(false); reload() })
  const withdraw = useAction(async (g: string) => { await api.plan.dining.withdrawDietary(r.id, g); reload() })
  const mine = requests.find((x) => x.guest === guest)
  return (
    <section aria-labelledby="diet-h">
      <h2 id="diet-h">{th('diet.title')}</h2>
      <p className="muted">{t('diet.intro')}</p>
      {requests.length > 0 && (
        <ul className="plain-list">
          {requests.map((x) => (
            <li key={x.guest}>
              <p><strong>{names([x.guest])}</strong>{' · '}{t(`diet.kind.${x.kind}` as never)}{': '}{x.note}</p>
              <p><StatusBadge kind={DIETARY_BADGE[x.status]} label={t(DIETARY_STATUS_LABEL[x.status])} /></p>
              <p className="muted" aria-live="polite">{t(DIETARY_STATUS_HELP[x.status])}</p>
              {canEdit && <Button variant="secondary" onClick={() => void withdraw.run(x.guest)}>{t('diet.withdraw', { name: names([x.guest]) })}</Button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); void send.run() }}>
          <div className="field">
            <label htmlFor="diet-guest">{t('diet.guest')}</label>
            <select id="diet-guest" className="field__input" value={guest} onChange={(e) => setGuest(e.target.value)}>
              {r.guests.map((g) => <option key={g} value={g}>{names([g])}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="diet-kind">{t('diet.kind')}</label>
            <select id="diet-kind" className="field__input" value={kind} onChange={(e) => setKind(e.target.value as DietaryKind)}>
              {DIETARY_KINDS.map((k) => <option key={k} value={k}>{t(`diet.kind.${k}` as never)}</option>)}
            </select>
          </div>
          <TextArea label={t('diet.note')} hint={t('diet.noteHint')} value={note} maxLength={DIETARY_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          <label className="choice">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            <span>{t('diet.ack')}</span>
          </label>
          <PlanError error={send.error} />
          <PlanError error={withdraw.error} />
          <Button type="submit" disabled={!canSendDietary({ kind, note, acknowledged }) || send.busy}>{mine ? t('diet.resend') : t('diet.send')}</Button>
        </form>
      )}
    </section>
  )
}
