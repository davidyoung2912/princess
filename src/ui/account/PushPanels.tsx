import { useEffect, useState } from 'react'
import { usePushState } from '../../hooks/usePushState'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { setBadge } from '../../push/browser'
import { feedUrl, webcalUrl, type PushLogEntry } from '../../push/push'
import { API_URL, api } from '../../runtime'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { ActionError, Load } from './parts'

/**
 * The permission flow (N3.1): a plain sentence about what this browser can do, and one button that asks only when tapped.
 * `question` is the in-context wording, such as "Allow all-aboard warnings?"; the browser's own prompt follows the tap.
 */
export function PushSwitch({ question }: { question?: string }) {
  const p = usePushState()
  const asking = question ?? t('push.question')
  if (p.support === 'needsInstall') return <Banner kind="info" title={t('push.install.title')}><p>{t('push.install.body')}</p></Banner>
  if (p.support === 'unsupported') return <Banner kind="info" title={t('push.unsupported.title')}><p>{t('push.unsupported.body')}</p></Banner>
  if (p.status && !p.status.available) return <Banner kind="info" title={t('push.unavailable.title')}><p>{t('push.unavailable.body')}</p></Banner>
  if (p.support === 'denied') return <Banner kind="warning" title={t('push.denied.title')}><p>{t('push.denied.body')}</p></Banner>
  const subscribed = p.status?.subscribed === true
  return (
    <Card labelledBy="push-h">
      <h2 id="push-h" className="card__title">{asking}</h2>
      <p>{t(subscribed ? 'push.on' : 'push.what')}</p>
      {p.problem === 'denied' && <p role="alert">{t('push.problem.denied')}</p>}
      {p.problem === 'failed' && <p role="alert">{t('push.problem.failed')}</p>}
      {subscribed
        ? <Button variant="secondary" disabled={p.busy} onClick={() => void p.turnOff()}>{t('push.turnOff')}</Button>
        : <Button disabled={p.busy || !p.status} onClick={() => void p.turnOn()}>{p.busy ? t('push.turningOn') : t('push.turnOn')}</Button>}
      <p className="muted">{t('push.limits')}</p>
    </Card>
  )
}

const stamp = (at: number) => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function LogRow({ e }: { e: PushLogEntry }) {
  const what = t(`push.kind.${e.kind}` as StringKey)
  const outcome = e.outcome === 'sent' ? t('push.log.sent') : t('push.log.held')
  return (
    <li>
      <p><strong>{what}</strong> · {outcome} <span className="muted">· {stamp(e.at)}</span></p>
      {e.outcome === 'held' && e.reason && <p className="muted">{t(`push.reason.${e.reason}` as StringKey)}</p>}
      {e.outcome === 'sent' && e.critical && <p className="muted">{t('push.log.critical')}</p>}
    </li>
  )
}

/** What was sent and what was held back, and why (N3.6). Opening it counts the alerts as seen and clears the badge. */
export function DeliveryLog() {
  const log = useMine(() => api.push.status())
  const unread = log.data?.unread ?? 0
  useEffect(() => { if (unread > 0) void api.push.markRead().then((s) => setBadge(s.unread)).catch(() => undefined) }, [unread])
  return (
    <section aria-labelledby="pushlog-h">
      <h2 id="pushlog-h">{th('push.log.title')}</h2>
      <p>{t('push.log.intro')}</p>
      <Load state={log}>
        {(s) => (s.log.length === 0
          ? <p className="muted">{t('push.log.none')}</p>
          : <ul className="plain-list">{s.log.map((e) => <LogRow key={`${e.key}-${e.outcome}-${e.at}`} e={e} />)}</ul>)}
      </Load>
    </section>
  )
}

/** The subscribable calendar (N3.4). The address is shown once, when it is made, because the server keeps only a fingerprint of it. */
export function CalendarFeed() {
  const feed = useMine(() => api.calendar.status())
  const [path, setPath] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const make = useAction(() => api.calendar.create())
  const revoke = useAction(() => api.calendar.revoke())
  const url = path ? feedUrl(API_URL, window.location.origin, path) : null
  return (
    <section aria-labelledby="cal-h">
      <h2 id="cal-h">{th('cal.title')}</h2>
      <p>{t('cal.intro')}</p>
      <Load state={feed}>
        {(f) => (
          <>
            {url && (
              <div className="field">
                <label htmlFor="cal-url">{t('cal.address')}</label>
                <input id="cal-url" className="field__input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
                <p className="field__hint">{t('cal.once')}</p>
                <div className="button-row">
                  <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => undefined) }}>{t('cal.copy')}</Button>
                  <a className="btn btn--secondary" href={webcalUrl(url)}>{th('cal.open')}</a>
                </div>
                <p role="status" className="muted">{copied ? t('cal.copied') : ''}</p>
              </div>
            )}
            {!url && f.on && <p>{t('cal.isOn')}</p>}
            <div className="button-row">
              <Button disabled={make.busy} variant={f.on ? 'secondary' : 'primary'} onClick={async () => { const r = await make.run(); if (r) { setPath(r.path); setCopied(false); feed.retry() } }}>{f.on ? t('cal.replace') : t('cal.make')}</Button>
              {f.on && <Button variant="secondary" disabled={revoke.busy} onClick={async () => { if (await revoke.run()) { setPath(null); feed.retry() } }}>{t('cal.off')}</Button>}
            </div>
            {f.on && <p className="muted">{t('cal.replaceHint')}</p>}
            <ActionError error={make.error ?? revoke.error} />
          </>
        )}
      </Load>
    </section>
  )
}

/** Texts go only to a phone number the guest has confirmed: a six-digit code is texted to the number on the profile and typed back here. */
export function PhoneCheck() {
  const status = useMine(() => api.phoneCheck.status())
  const [code, setCode] = useState('')
  const send = useAction(() => api.phoneCheck.sendCode())
  const confirm = useAction((c: string) => api.phoneCheck.confirm(c))
  return (
    <section aria-labelledby="phone-h">
      <h2 id="phone-h">{th('phoneCheck.title')}</h2>
      <p>{t('phoneCheck.intro')}</p>
      <Load state={status}>
        {(s) => !s.hasPhone
          ? <p className="muted">{t('phoneCheck.none')}</p>
          : s.verified
            ? <p role="status">{t('phoneCheck.verified')}</p>
            : (
              <>
                <p>{t('phoneCheck.not')}</p>
                <Button variant={s.pending ? 'secondary' : 'primary'} disabled={send.busy} onClick={async () => { if (await send.run()) { setCode(''); status.retry() } }}>{s.pending ? t('phoneCheck.resend') : t('phoneCheck.send')}</Button>
                {send.error?.code === 'conflict' ? <p role="alert" className="field__error">{t('phoneCheck.err.soon')}</p> : send.error?.code === 'invalid' ? <p role="alert" className="field__error">{t('phoneCheck.err.phone')}</p> : <ActionError error={send.error} />}
                {s.pending && (
                  <form onSubmit={async (e) => { e.preventDefault(); if (await confirm.run(code)) { setCode(''); status.retry() } }}>
                    <div className="field">
                      <label htmlFor="phone-code">{t('phoneCheck.code')}</label>
                      <input id="phone-code" className="field__input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
                      <p className="field__hint">{t('phoneCheck.codeHint')}</p>
                    </div>
                    {confirm.error?.code === 'invalid' ? <p role="alert" className="field__error">{t('phoneCheck.err.code')}</p> : <ActionError error={confirm.error} />}
                    <Button type="submit" disabled={confirm.busy || code.trim().length !== 6}>{t('phoneCheck.confirm')}</Button>
                  </form>
                )}
              </>
            )}
      </Load>
    </section>
  )
}
