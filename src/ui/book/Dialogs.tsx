import { useState, type FormEvent } from 'react'
import type { ResumeSent } from '../../api/types'
import type { Draft } from '../../domain/booking'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { ActionError } from '../account/parts'

/** Sends a link back to this draft by email or text, to finish later on any device (BOK-01). The pretend message is shown on screen, since nothing is really sent. */
export function ResumeLinkDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [via, setVia] = useState<'email' | 'sms'>('email')
  const [email, setEmail] = useState(draft.contact.email)
  const [phone, setPhone] = useState(draft.contact.phone)
  const [sent, setSent] = useState<ResumeSent | null>(null)
  const send = useAction((v: 'email' | 'sms', to: string) => api.booking.sendResumeLink(v, to))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const result = await send.run(via, via === 'email' ? email : phone)
    if (result) setSent(result)
  }
  const code = send.error?.code
  return (
    <Dialog title={t('book.link.title')} onClose={onClose}>
      {sent ? (
        <>
          <Banner kind="success" title={t('book.link.sent', { to: sent.to })} />
          <p className="muted">{t('book.link.demo')}</p>
          <p><a href={sent.link}>{`${window.location.origin}${sent.link}`}</a></p>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate>
          <p>{t('book.link.intro')}</p>
          <fieldset>
            <legend>{t('book.link.how')}</legend>
            <label className="choice"><input type="radio" name="via" checked={via === 'email'} onChange={() => setVia('email')} /><span>{t('book.link.email')}</span></label>
            <label className="choice"><input type="radio" name="via" checked={via === 'sms'} onChange={() => setVia('sms')} /><span>{t('book.link.sms')}</span></label>
          </fieldset>
          {via === 'email'
            ? <Field label={t('book.field.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            : <Field label={t('book.field.phone')} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          {code === 'invalid' && <p role="alert" className="field__error">{t('book.link.invalid')}</p>}
          {code === 'notFound' && <p role="alert" className="field__error">{t('book.link.nothing')}</p>}
          {code !== 'invalid' && code !== 'notFound' && <ActionError error={send.error} />}
          <div className="button-row">
            <Button type="submit" disabled={send.busy}>{send.busy ? t('account.saving') : t('book.link.send')}</Button>
            <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

/** Throws the draft away, after asking. */
export function StartOverDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const discard = useAction(async () => { await api.booking.discardDraft(); return true })
  const confirm = async () => { if (await discard.run()) onDone() }
  return (
    <Dialog title={t('book.restart.title')} onClose={onClose}>
      <p>{t('book.restart.body')}</p>
      <ActionError error={discard.error} />
      <div className="button-row">
        <Button variant="danger" disabled={discard.busy} onClick={() => void confirm()}>{t('book.restart.confirm')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('book.restart.keep')}</Button>
      </div>
    </Dialog>
  )
}
