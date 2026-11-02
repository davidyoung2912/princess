import { useState } from 'react'
import { Link } from 'react-router'
import { disruptionById, validOption } from '../../domain/disruption'
import { formatDate } from '../../domain/cruise'
import { CALLBACK_LIFETIME_MS, awaitingDebrief, callbackStatus, hubFor, normalizeCallbacks, hubItems, knockOnCounts, needsHumanReview, addDebrief, orderedGuides, OUTAGE_WORKS, RATINGS, type CallbackRequest, type Rating } from '../../domain/disruptionHub'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import type { ScenarioId } from '../../domain/scenarios'
import { api, cancelStaffTicket, staffRequest, staffTickets } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { useAction } from '../../hooks/useAction'
import { useDemo, useNow } from '../../hooks/useDemo'
import { useHub } from '../../hooks/useHub'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { TextArea } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { ActionError, Load } from '../account/parts'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'

const REASONS: readonly CallbackRequest['reason'][] = ['urgent', 'changes', 'health', 'other']

/** The Disruption Hub (XD-01 to XD-10): for any change, what happened, what it means for me, what is already done, what I can choose, what happens next and how to reach a person. */
export function DisruptionHubScreen() {
  const demo = useDemo()
  const updates = useMine(() => api.updates.list())
  return (
    <div className="page">
      <h1>{t('route.disruption')}</h1>
      <p>{t('hub.intro')}</p>
      {demo.network.offline && (
        <Banner kind="offline" title={t('hub.outage.title')}>
          <p>{t('hub.outage.body')}</p>
          <ul>{OUTAGE_WORKS.map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </Banner>
      )}
      <Load state={updates}>
        {(list) => {
          const active = list.filter((u) => u.active)
          const items = hubItems(active.map((u) => u.id))
          const ended = list.filter((u) => !u.active).map((u) => u.id)
          return (
            <>
              {items.length === 0 ? <Card info><p>{t('hub.none')}</p></Card> : items.map((i) => <HubCard key={i.def.id} id={i.def.id} view={list.find((u) => u.id === i.def.id)!} onChanged={updates.retry} />)}
              <Debriefs ended={ended} />
            </>
          )
        }}
      </Load>
      <Callback />
      <Guides />
      <Contacts />
      <BackLink to="/" label={t('route.home')} />
    </div>
  )
}

function HubCard({ id, view, onChanged }: { id: ScenarioId; view: { ack: { option: string; at: number } | null }; onChanged: () => void }) {
  const def = disruptionById(id)!
  const hub = hubFor(id)!
  const { me } = useHub()
  const shipTime = useShipTime()
  const ack = useAction(async (option: string) => { if (validOption(def, option)) await api.updates.acknowledge(def.id, option); onChanged() })
  const counts = knockOnCounts(hub.knockOns)
  const chosen = def.options.find((o) => o.id === view.ack?.option)
  return (
    <Card labelledBy={`hub-${def.id}`}>
      <h2 id={`hub-${def.id}`} className="card__title">{t(def.title)}</h2>
      <p><StatusBadge kind={def.severity === 'info' ? 'ready' : 'changed'} label={t(`disrupt.sev.${def.severity}` as StringKey)} /></p>
      <h3>{t('hub.meaning')}</h3>
      <p>{t(hub.meaning)}</p>
      <h3>{t('hub.done')}</h3>
      <ul>{hub.done.map((k) => <li key={k}>{t(k)}</li>)}</ul>
      {hub.knockOns.length > 0 && (
        <>
          <h3>{t('hub.knock')}</h3>
          <p className="muted">{t('hub.knock.summary', { refunded: counts.refunded, moved: counts.moved, cancelled: counts.cancelled, kept: counts.kept })}</p>
          <ul className="plain-list">
            {hub.knockOns.map((k) => <li key={k.id}><span>{t(k.item)}<small className="muted"> · {t(k.detail)}</small></span><StatusBadge kind={k.outcome === 'kept' ? 'ready' : 'changed'} label={t(`hub.outcome.${k.outcome}` as StringKey)} /></li>)}
          </ul>
        </>
      )}
      <h3>{t('hub.comp')}</h3>
      {hub.compensation ? (
        <ul>
          <li><strong>{t('hub.comp.given')}</strong> {t(hub.compensation.given)}</li>
          <li><strong>{t('hub.comp.arrives')}</strong> {t(hub.compensation.arrives)}</li>
          <li><strong>{t('hub.comp.todo')}</strong> {t(hub.compensation.todo)}</li>
        </ul>
      ) : <p>{t('hub.comp.none')}</p>}
      <h3>{t('hub.next')}</h3>
      <p>{t(hub.next)}</p>
      {def.link && <p><Link to={def.link}>{t('disrupt.see')}</Link></p>}
      <h3>{t('hub.choose')}</h3>
      <ActionError error={ack.error} />
      {view.ack ? (
        <p role="status">{t('disrupt.recorded', { choice: chosen ? t(chosen.label) : '', time: shipTime(view.ack.at), date: formatDate(new Date(view.ack.at).toISOString().slice(0, 10)) })}</p>
      ) : me?.child ? <p className="muted">{t('disrupt.adultOnly')}</p> : (
        <div className="button-row" role="group" aria-label={t('disrupt.choose')}>
          {def.options.map((o, i) => <Button key={o.id} variant={i === 0 ? 'primary' : 'secondary'} disabled={ack.busy} onClick={() => void ack.run(o.id)}>{t(o.label)}</Button>)}
        </div>
      )}
    </Card>
  )
}

/** A callback with a place in the line (XD-04). The desk number stays on the page for when there is no signal. */
function Callback() {
  const { me } = useHub()
  const now = useNow()
  const [reason, setReason] = useState<CallbackRequest['reason']>('changes')
  const [failed, setFailed] = useState(false)
  const tickets = useAsync(async () => normalizeCallbacks(await staffTickets()), [])
  const c = tickets.data?.find((x) => callbackStatus(x, now).kind !== 'lapsed') ?? tickets.data?.[0] ?? null
  const status = c ? callbackStatus(c, now) : null
  /** The server's place in the staff queue, kept there so every device shows it. If the server cannot be reached nothing is pretended: the guest is told and the desk number stays on the page. */
  const askForCall = async () => {
    setFailed(false)
    try {
      await staffRequest('callback', reason)
      tickets.retry()
    } catch { setFailed(true) }
  }
  const cancel = async () => {
    if (!c) return
    try { await cancelStaffTicket(c.id); tickets.retry() } catch { setFailed(true) }
  }
  return (
    <section aria-labelledby="hub-cb-h">
      <h2 id="hub-cb-h">{t('hub.cb.title')}</h2>
      <Card>
        <p>{t('hub.cb.intro')}</p>
        <p><strong>{t('hub.cb.number', { number: GUEST_SERVICES_NUMBER })}</strong></p>
        {c && status && status.kind !== 'lapsed' ? (
          <>
            <p role="status">{status.kind === 'due' ? t('hub.cb.due') : t('hub.cb.waiting', { position: c.position, minutes: status.minutes })}</p>
            <p className="muted">{t('hub.cb.sim', { hours: CALLBACK_LIFETIME_MS / 3_600_000 })}</p>
            <Button variant="secondary" onClick={() => void cancel()}>{t('hub.cb.cancel')}</Button>
          </>
        ) : (
          <>
            {status?.kind === 'lapsed' && <p role="status">{t('hub.cb.lapsed')}</p>}
            <fieldset>
              <legend>{t('hub.cb.reason')}</legend>
              {REASONS.map((r) => (
                <label key={r} className="choice"><input type="radio" name="cb-reason" checked={reason === r} onChange={() => setReason(r)} /><span>{t(`hub.cb.reason.${r}` as StringKey)}</span></label>
              ))}
            </fieldset>
            {failed && <p role="alert">{t('hub.cb.failed', { number: GUEST_SERVICES_NUMBER })}</p>}
            <Button disabled={!!me?.child} onClick={() => void askForCall()}>{t('hub.cb.ask')}</Button>
          </>
        )}
      </Card>
    </section>
  )
}

/** The follow-up after a change is over (XD-10): one question, and a person looks at anything that went badly. */
function Debriefs({ ended }: { ended: string[] }) {
  const { state, update } = useHub()
  const now = useNow()
  const [note, setNote] = useState('')
  const waiting = awaitingDebrief(ended, state.debriefs)
  const answered = state.debriefs.filter((d) => ended.includes(d.id))
  if (waiting.length === 0 && answered.length === 0) return null
  const rate = (id: (typeof waiting)[number], rating: Rating) => { update((s) => ({ ...s, debriefs: addDebrief(s.debriefs, id, rating, note, now) })); setNote('') }
  return (
    <section aria-labelledby="hub-db-h">
      <h2 id="hub-db-h">{t('hub.debrief.title')}</h2>
      {waiting.map((id) => (
        <Card key={id} labelledBy={`db-${id}`}>
          <h3 id={`db-${id}`}>{t(disruptionById(id)!.title)}</h3>
          <p>{t('hub.debrief.ask')}</p>
          <TextArea label={t('hub.debrief.note')} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
          <div className="button-row" role="group" aria-label={t('hub.debrief.ask')}>
            {RATINGS.map((r) => <Button key={r} variant="secondary" onClick={() => rate(id, r)}>{t(`hub.debrief.${r}` as StringKey)}</Button>)}
          </div>
        </Card>
      ))}
      {answered.map((d) => (
        <p key={d.id} role="status">{t(disruptionById(d.id)!.title)}: {t(needsHumanReview(d) ? 'hub.debrief.review' : 'hub.debrief.thanks')}</p>
      ))}
    </section>
  )
}

/** Step-by-step help for the things that go wrong without warning (XD-05, XD-06, XD-08, XD-09), always available. */
function Guides() {
  const scenarios = useDemo().scenarios
  return (
    <section aria-labelledby="hub-guides-h">
      <h2 id="hub-guides-h">{t('hub.guides')}</h2>
      {orderedGuides(scenarios).map((g) => (
        <Card key={g.id} labelledBy={`g-${g.id}`}>
          <h3 id={`g-${g.id}`} className="card__title">{t(g.title)}</h3>
          <ol>{g.steps.map((k) => <li key={k}>{t(k)}</li>)}</ol>
          {g.link && <p><Link to={g.link}>{t('hub.guide.open')}</Link></p>}
        </Card>
      ))}
    </section>
  )
}

function Contacts() {
  return (
    <section aria-labelledby="hub-human-h">
      <h2 id="hub-human-h">{t('hub.human')}</h2>
      <p>{t('hub.human.body', { desk: GUEST_SERVICES_NUMBER, emergency: EMERGENCY_NUMBER })}</p>
      <p><Link to="/home/delayed">{t('route.delayed')}</Link> · <Link to="/plan/family-link">{t('route.familyLink')}</Link> · <Link to="/me/contact">{t('route.contact')}</Link> · <Link to="/home/updates">{t('route.updates')}</Link></p>
    </section>
  )
}

