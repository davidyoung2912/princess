import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { isEmail, isPhone } from '../domain/signup'
import { useAction } from '../hooks/useAction'
import { useMine } from '../hooks/useMine'
import { t, th } from '../i18n'
import { api } from '../runtime'
import { ActionError } from './account/parts'
import { EmailCheck, PhoneCheck } from './account/PushPanels'
import { Banner } from './Banner'
import { Button } from './Button'
import { Card } from './Card'
import { Field } from './Field'
import { PhoneField } from './PhoneField'

export type ContactKind = 'email' | 'phone'

/**
 * One page of the code check: a six-digit code, good for 15 minutes, is sent to the email address or the phone number and typed back. It can be skipped, but not
 * quietly: the guest is told that no notices will go to that address or number until they confirm it (from Settings, any time).
 */
export function VerifyStep({ kind, onDone }: { kind: ContactKind; onDone: () => void }) {
  const [warn, setWarn] = useState(false)
  return (
    <div className="page welcome app-welcome">
      <Card hero labelledBy="verify-intro-h">
        <h2 id="verify-intro-h">{th(`verify.${kind}.title`)}</h2>
        <p>{t(`verify.${kind}.intro`)}</p>
      </Card>
      {kind === 'email' ? <EmailCheck onVerified={onDone} /> : <PhoneCheck onVerified={onDone} />}
      {warn
        ? (
          <Banner kind="warning" title={t('verify.skip.title')} action={<div className="button-row"><Button variant="secondary" onClick={() => setWarn(false)}>{t('verify.skip.back')}</Button><Button onClick={onDone}>{t('verify.skip.anyway')}</Button></div>}>
            <p>{t(`verify.skip.${kind}`)}</p>
          </Banner>
        )
        : <div className="button-row"><Button variant="secondary" onClick={() => setWarn(true)}>{t('verify.skip')}</Button></div>}
    </div>
  )
}

/** Settings: enter, change or clear the email address and phone number, and confirm each by code later. Both are optional; neither has to be unique. */
export function ContactSettings({ onVerify }: { onVerify: (kind: ContactKind) => void }) {
  const [bump, setBump] = useState(0)
  const stored = useMine(() => api.contact.get(), [bump])
  const email = useMine(() => api.emailCheck.status(), [bump])
  const phone = useMine(() => api.phoneCheck.status(), [bump])
  const [edited, setForm] = useState<{ email: string; phone: string } | null>(null)
  const form = edited ?? stored.data ?? { email: '', phone: '' }
  const [problems, setProblems] = useState<{ email?: boolean; phone?: boolean }>({})
  const [saved, setSaved] = useState(false)
  const save = useAction((c: { email: string; phone: string }) => api.contact.save(c))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    const next = { email: !!form.email.trim() && !isEmail(form.email), phone: !!form.phone.trim() && !isPhone(form.phone) }
    setProblems(next)
    if (next.email || next.phone) return
    if (await save.run({ email: form.email.trim(), phone: form.phone.trim() })) { setSaved(true); setBump((n) => n + 1) }
  }
  const unconfirmed = (email.data?.hasEmail && !email.data.verified) || (phone.data?.hasPhone && !phone.data.verified)
  if (!stored.data) return null
  return (
    <Card labelledBy="contact-h">
      <h2 id="contact-h">{th('contactSettings.title')}</h2>
      <p>{t('contactSettings.intro')}</p>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Field label={t('signin.signup.email')} hint={t('signin.signup.optional')} value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setSaved(false) }} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} error={problems.email || save.error?.code === 'invalid' ? t('signin.signup.problem.email') : undefined} />
        <PhoneField label={t('signin.signup.phone')} hint={t('signin.signup.optional')} value={form.phone} onChange={(v) => { setForm({ ...form, phone: v }); setSaved(false) }} error={problems.phone ? t('signin.signup.problem.phone') : undefined} />
        {save.error?.code !== 'invalid' && <ActionError error={save.error} />}
        <div className="button-row"><Button type="submit" disabled={save.busy}>{save.busy ? t('account.saving') : t('contactSettings.save')}</Button></div>
        {saved && <p role="status">{t('contactSettings.saved')}</p>}
      </form>
      {(['email', 'phone'] as const).map((k) => {
        const info = k === 'email' ? email.data?.hasEmail && { verified: email.data.verified } : phone.data?.hasPhone && { verified: phone.data.verified }
        return info && (
          <div key={k} className="contact-status">
            <p>{info.verified ? t(`contactSettings.${k}.ok`) : t(`contactSettings.${k}.not`)}</p>
            {!info.verified && <div className="button-row"><Button variant="secondary" onClick={() => onVerify(k)}>{t(k === 'email' ? 'contactSettings.confirmEmail' : 'contactSettings.confirmPhone')}</Button></div>}
          </div>
        )
      })}
      {unconfirmed && <Banner kind="warning" title={t('contactSettings.warn.title')}><p>{t('contactSettings.warn.body')}</p></Banner>}
    </Card>
  )
}

/**
 * My Details: the same warning as Settings when the guest's email address or phone number is missing or not confirmed, each with a way to fix it: Confirm opens the
 * welcome-step page (`onVerify`), and a missing one points to Settings, where it is entered. Nothing shows when both are confirmed.
 */
export function ContactNotices({ onVerify }: { onVerify: (kind: ContactKind) => void }) {
  const email = useMine(() => api.emailCheck.status())
  const phone = useMine(() => api.phoneCheck.status())
  if (!email.data || !phone.data) return null
  const rows = [
    { kind: 'email' as const, has: email.data.hasEmail, verified: email.data.verified },
    { kind: 'phone' as const, has: phone.data.hasPhone, verified: phone.data.verified },
  ].filter((r) => !r.has || !r.verified)
  if (rows.length === 0) return null
  return (
    <Banner kind="warning" title={t('contactSettings.warn.title')}>
      <p>{t('contactSettings.warn.body')}</p>
      {rows.map((r) => (
        <div key={r.kind} className="contact-status">
          <p>{r.has ? t(`contactSettings.${r.kind}.not`) : t(`contactNotice.${r.kind}.none`)}</p>
          <div className="button-row">
            {r.has
              ? <Button variant="secondary" onClick={() => onVerify(r.kind)}>{t(r.kind === 'email' ? 'contactSettings.confirmEmail' : 'contactSettings.confirmPhone')}</Button>
              : <Link className="btn btn--secondary" to="/me/settings">{t(r.kind === 'email' ? 'contactNotice.addEmail' : 'contactNotice.addPhone')}</Link>}
          </div>
        </div>
      ))}
    </Banner>
  )
}
