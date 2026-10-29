import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { phoneOk } from '../../domain/account'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { CONTACT_OPTIONS, contactStatus, SUPPORT_EMAIL } from '../../domain/help'
import { offsetMinutes } from '../../domain/timezones'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useNow } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { formatMoment } from './format'
import { ActionError, Load } from './parts'

/** Contact options (SUP-02): every way to reach a person, with hours and the usual wait shown before you choose, and requests you can track. */
export function ContactScreen() {
  const now = useNow()
  const hour = (((now + offsetMinutes(now, 'America/New_York') * 60_000) % 86_400_000) + 86_400_000) % 86_400_000 / 3_600_000
  const tickets = useMine(() => api.support.tickets())
  const [phone, setPhone] = useState('')
  const [phoneProblem, setPhoneProblem] = useState(false)
  const [message, setMessage] = useState('')
  const [messageProblem, setMessageProblem] = useState(false)
  const [sent, setSent] = useState<'callback' | 'email' | null>(null)
  const callback = useAction((p: string) => api.support.callback(p))
  const email = useAction((m: string) => api.support.email(m))

  const askCallback = async (e: FormEvent) => {
    e.preventDefault()
    setSent(null)
    setPhoneProblem(!phoneOk(phone))
    if (!phoneOk(phone)) return
    if (await callback.run(phone)) { setPhone(''); setSent('callback'); tickets.retry() }
  }
  const sendEmail = async (e: FormEvent) => {
    e.preventDefault()
    setSent(null)
    setMessageProblem(!message.trim())
    if (!message.trim()) return
    if (await email.run(message)) { setMessage(''); setSent('email'); tickets.retry() }
  }

  return (
    <div className="page">
      <h1>{t('route.contact')}</h1>
      <p>{t('contact.intro')}</p>
      <p><Link to="/home/concierge">{t('contact.tryConcierge')}</Link></p>
      <ul className="card-grid">
        {CONTACT_OPTIONS.map((o) => {
          const s = contactStatus(o, hour)
          return (
            <li key={o.id} className="card">
              <h2 className="card__title">{t(`contact.${o.id}` as StringKey)}</h2>
              <p><StatusBadge kind={s.open ? 'booked' : 'cancelled'} label={s.open ? t('contact.open') : t('contact.closed')} /></p>
              <p className="muted">{o.hours ? t('contact.hours', { from: o.hours[0], to: o.hours[1] }) : t('contact.always')}{s.open && s.waitMinutes !== null && o.id !== 'callback' ? ` · ${t('contact.wait', { count: s.waitMinutes })}` : ''}{o.id === 'email' ? ` · ${t('contact.emailReply')}` : ''}</p>
              {o.id === 'chat' && <LinkButton to="/chat" variant="secondary">{t('contact.startChat')}</LinkButton>}
              {o.id === 'phone' && <a className="btn btn--secondary" href={`tel:${GUEST_SERVICES_NUMBER}`}>{GUEST_SERVICES_NUMBER}</a>}
            </li>
          )
        })}
      </ul>

      <section aria-labelledby="cb-h">
        <h2 id="cb-h">{t('contact.callback')}</h2>
        <form onSubmit={(e) => void askCallback(e)} noValidate>
          <Field label={t('contact.phoneField')} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneProblem ? t('contact.phoneProblem') : undefined} />
          <ActionError error={callback.error} />
          <Button type="submit" variant="secondary" disabled={callback.busy}>{callback.busy ? t('account.saving') : t('contact.callbackButton')}</Button>
        </form>
      </section>

      <section aria-labelledby="em-h">
        <h2 id="em-h">{t('contact.email')}</h2>
        <form onSubmit={(e) => void sendEmail(e)} noValidate>
          <TextArea label={t('contact.messageField')} hint={t('contact.messageHint', { address: SUPPORT_EMAIL })} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
          {messageProblem && <p role="alert" className="field__error">{t('contact.messageProblem')}</p>}
          <ActionError error={email.error} />
          <Button type="submit" variant="secondary" disabled={email.busy}>{email.busy ? t('account.saving') : t('contact.emailButton')}</Button>
        </form>
      </section>
      <p role="status">{sent ? t(`contact.sent.${sent}` as StringKey) : ''}</p>

      <section aria-labelledby="tk-h">
        <h2 id="tk-h">{t('contact.tickets')}</h2>
        <Load state={tickets}>
          {(list) => list.length === 0 ? <Card info><p>{t('contact.noTickets')}</p></Card> : (
            <ul className="plain-list">
              {list.map((k) => (
                <li key={k.id}>
                  <span><strong>{t(`contact.ticket.${k.kind}` as StringKey)}</strong> · {k.detail.slice(0, 60)}<br /><span className="muted">{formatMoment(k.at)}</span></span>
                  <StatusBadge kind={k.status === 'resolved' ? 'booked' : k.status === 'inProgress' ? 'waitlist' : 'ready'} label={t(`contact.status.${k.status}` as StringKey)} />
                </li>
              ))}
            </ul>
          )}
        </Load>
      </section>
    </div>
  )
}
