import { useState } from 'react'
import { nextDeadline, claimRecord, DELAY_REASONS, delayNextSteps, expectedArrival, LATE_CHOICES, reportDelay, resolveDelay, setShareEta, type DelayReason } from '../../domain/delay'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { stageAt } from '../../domain/sailings'
import { newHubId, useHub } from '../../hooks/useHub'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useParty } from '../../hooks/useParty'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { TextArea } from '../Field'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'

/** "I'm delayed" (S4A-03) and share my ETA (S4A-08): one tap tells the line (a mock) and the party, shows the next steps and keeps a record for a claim. */
export function DelayedScreen() {
  const { state, update, me } = useHub()
  const { note: tellParty } = useParty()
  const sailing = useSailing()
  const now = useNow()
  const shipTime = useShipTime()
  const stage = stageAt(sailing, now)
  const [reason, setReason] = useState<DelayReason>('traffic')
  const [late, setLate] = useState<number>(30)
  const [text, setText] = useState('')
  const [party, setParty] = useState(true)
  const { current, history, shareEta } = state.delay
  const planned = nextDeadline(sailing, now)

  const send = () => {
    update((s) => ({ ...s, delay: reportDelay(s.delay, { reason, lateMinutes: late, note: text, tellParty: party }, now, newHubId()) }))
    if (party) tellParty(t('delay.partyNote', { name: me?.firstName ?? '', minutes: late }))
    setText('')
  }

  return (
    <div className="page">
      <p>{t('delay.intro')}</p>
      <Banner kind="info" title={t('delay.call', { number: GUEST_SERVICES_NUMBER })}><p>{t('delay.callBody')}</p></Banner>
      {current ? (
        <Card labelledBy="delay-now">
          <h2 id="delay-now" className="card__title">{th('delay.open')}</h2>
          <p role="status">{t('delay.told', { who: current.told.map((w) => t(`delay.who.${w}` as StringKey)).join(', '), minutes: current.lateMinutes })}</p>
          {planned !== null && shareEta && <p>{t('delay.eta', { time: shipTime(expectedArrival(planned, current)) })}</p>}
          <h3>{th('delay.steps')}</h3>
          <ol>{delayNextSteps(stage).map((k) => <li key={k}>{t(k)}</li>)}</ol>
          <Button onClick={() => update((s) => ({ ...s, delay: resolveDelay(s.delay, now) }))}>{t('delay.arrived')}</Button>
        </Card>
      ) : (
        <Card labelledBy="delay-new">
          <h2 id="delay-new" className="card__title">{th('delay.new')}</h2>
          <fieldset>
            <legend>{t('delay.reason')}</legend>
            {DELAY_REASONS.map((r) => <label key={r} className="choice"><input type="radio" name="delay-reason" checked={reason === r} onChange={() => setReason(r)} /><span>{t(`delay.reason.${r}` as StringKey)}</span></label>)}
          </fieldset>
          <fieldset>
            <legend>{t('delay.late')}</legend>
            {LATE_CHOICES.map((m) => <label key={m} className="choice"><input type="radio" name="delay-late" checked={late === m} onChange={() => setLate(m)} /><span>{t('delay.late.minutes', { minutes: m })}</span></label>)}
          </fieldset>
          <TextArea label={t('delay.noteLabel')} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
          <label className="choice"><input type="checkbox" checked={party} onChange={(e) => setParty(e.target.checked)} /><span>{t('delay.tellParty')}</span></label>
          <Button disabled={!!me?.child} onClick={send}>{t('delay.send')}</Button>
          {me?.child && <p className="muted">{t('disrupt.adultOnly')}</p>}
        </Card>
      )}
      <label className="choice"><input type="checkbox" checked={shareEta} onChange={(e) => update((s) => ({ ...s, delay: setShareEta(s.delay, e.target.checked) }))} /><span>{t('delay.share')}<small>{t('delay.share.why')}</small></span></label>
      {history.length > 0 || current ? (
        <section aria-labelledby="delay-rec">
          <h2 id="delay-rec">{th('delay.record')}</h2>
          <p className="muted">{t('delay.record.why')}</p>
          {[...(current ? [current] : []), ...history].map((r) => (
            <Card key={r.id}>
              <dl>
                {claimRecord(r, t(`delay.reason.${r.reason}` as StringKey), `${new Date(r.at).toISOString().slice(0, 10)} ${shipTime(r.at)}`).map((l) => <div key={l.label}><dt>{t(l.label)}</dt><dd>{l.value}</dd></div>)}
              </dl>
              <p className="muted">{r.resolvedAt ? t('delay.record.resolved', { time: shipTime(r.resolvedAt) }) : t('delay.record.open')}</p>
            </Card>
          ))}
        </section>
      ) : null}
      <BackLink to="/" label={t('route.home')} />
    </div>
  )
}
