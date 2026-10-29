import { useState } from 'react'
import { Link } from 'react-router'
import type { AssistanceView } from '../../api/types'
import { ASSIST_KINDS, assistKind, type AssistId, type DeadlineState } from '../../domain/assistance'
import { formatDate } from '../../domain/cruise'
import type { PersonaId } from '../../domain/personas'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { TextArea } from '../Field'
import { StatusBadge, type BadgeKind } from '../StatusBadge'
import { Load } from '../account/parts'
import { PlanError, ReadOnly, Back } from './common'
import { firstName } from './people'

const BADGE: Record<DeadlineState, BadgeKind> = { open: 'ready', soon: 'waitlist', late: 'changed' }

/** Special assistance and accessibility requests, with a countdown to each cut-off (MNG-12). */
export function AssistanceScreen() {
  const view = useMine(() => api.plan.assistance.get())
  return (
    <div className="page">
      <h1>{t('route.assistance')}</h1>
      <p>{t('assist.intro')}</p>
      <Load state={view}>{(v) => <Body view={v} reload={view.retry} />}</Load>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}

function Body({ view, reload }: { view: AssistanceView; reload: () => void }) {
  const [kind, setKind] = useState<AssistId>('wheelchair')
  const [guest, setGuest] = useState<PersonaId>(view.party[0].id)
  const [note, setNote] = useState('')
  const [sent, setSent] = useState<AssistId | null>(null)
  const send = useAction(async () => { const v = await api.plan.assistance.request({ kind, guest, note }); reload(); return v })
  const withdraw = useAction(async (id: string) => { await api.plan.assistance.cancel(id); reload() })
  const def = assistKind(kind)!
  const dl = view.deadlines.find((d) => d.kind === kind)!.deadline

  const submit = async () => {
    if (await send.run()) { setSent(kind); setNote('') }
  }

  return (
    <>
      <ReadOnly canDo={view.canRequest} />
      <section aria-labelledby="track-h">
        <h2 id="track-h">{t('assist.tracker')}</h2>
        <p className="muted">{t('assist.trackerHint')}</p>
        <ul className="plain-list">
          {ASSIST_KINDS.map((k) => {
            const d = view.deadlines.find((x) => x.kind === k.id)!.deadline
            const asked = view.requests.some((r) => r.kind === k.id)
            return (
              <li key={k.id}>
                <span><strong>{t(`assist.kind.${k.id}` as never)}</strong><br /><span className="muted">{t('assist.notice', { count: k.noticeDays, date: formatDate(d.by) })}</span></span>
                {asked ? <StatusBadge kind="booked" label={t('assist.asked')} /> : <StatusBadge kind={BADGE[d.state]} label={d.state === 'late' ? t('assist.late') : t('assist.daysLeft', { count: d.daysLeft })} />}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="req-h">
        <h2 id="req-h">{t('assist.new')}</h2>
        <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <div className="field">
            <label htmlFor="as-kind">{t('assist.what')}</label>
            <select id="as-kind" value={kind} disabled={!view.canRequest} onChange={(e) => { setKind(e.target.value as AssistId); setSent(null) }}>
              {ASSIST_KINDS.map((k) => <option key={k.id} value={k.id}>{t(`assist.kind.${k.id}` as never)}</option>)}
            </select>
          </div>
          {view.party.length > 1 && (
            <div className="field">
              <label htmlFor="as-guest">{t('assist.who')}</label>
              <select id="as-guest" value={guest} disabled={!view.canRequest} onChange={(e) => setGuest(e.target.value as PersonaId)}>
                {view.party.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
          <p>{t(`assist.help.${kind}` as never)}</p>
          {dl.state === 'late' && <Banner kind="warning" title={t('assist.lateTitle', { date: formatDate(dl.by) })}><p>{t('assist.lateBody')}</p></Banner>}
          <TextArea label={def.noteRequired ? t('assist.noteRequired') : t('assist.note')} hint={t('assist.noteHint')} value={note} maxLength={300} disabled={!view.canRequest} onChange={(e) => setNote(e.target.value)} />
          <PlanError error={send.error} />
          {sent && <p role="status" className="muted">{t('assist.sent', { name: t(`assist.kind.${sent}` as never) })}</p>}
          <Button type="submit" disabled={!view.canRequest || send.busy}>{send.busy ? t('account.saving') : t('assist.send')}</Button>
        </form>
      </section>

      <section aria-labelledby="mine-h">
        <h2 id="mine-h">{t('assist.mine')}</h2>
        <PlanError error={withdraw.error} />
        {view.requests.length === 0 ? <p className="muted">{t('assist.none')}</p> : (
          <ul className="card-grid">
            {view.requests.map((r) => (
              <li key={r.id} className="card">
                <h3 className="card__title">{t(`assist.kind.${r.kind}` as never)}</h3>
                <p>{firstName(r.guest)}</p>
                {r.note && <p className="muted">{r.note}</p>}
                <p>{r.status === 'confirmed' ? <StatusBadge kind="booked" label={t('assist.status.confirmed')} /> : r.status === 'late' ? <StatusBadge kind="changed" label={t('assist.status.late')} /> : <StatusBadge kind="waitlist" label={t('assist.status.received')} />}</p>
                {r.status === 'late' && <p className="muted">{t('assist.status.lateBody')}</p>}
                {view.canRequest && <Button variant="tertiary" disabled={withdraw.busy} onClick={() => void withdraw.run(r.id)}>{t('assist.withdraw')}<span className="visually-hidden"> {t(`assist.kind.${r.kind}` as never)}, {firstName(r.guest)}</span></Button>}
              </li>
            ))}
          </ul>
        )}
        {Object.keys(view.needs).length > 0 && (
          <Card info>
            <h3 className="card__title">{t('assist.profile')}</h3>
            <ul className="plain-bullets">{Object.entries(view.needs).map(([id, needs]) => <li key={id}>{firstName(id as PersonaId)}: {needs.map((n) => t(`profile.needs.${n}` as never)).join(', ')}</li>)}</ul>
            <p><Link to="/me/profile">{t('route.profile')}</Link></p>
          </Card>
        )}
      </section>
    </>
  )
}
