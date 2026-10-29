import { useState } from 'react'
import { ADVISORS, ADVISOR_LANGUAGES, ADVISOR_SPECIALITIES, ASSIST_KINDS, CONSENT_REGIONS, advisorsFor, doubleOptInFor, type AdvisorWay, type AssistKind, type MarketingChannel } from '../../domain/ahead'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { formatDateTime } from '../account/format'
import { AheadError, Back, ChildNote } from './common'

/** Find a travel advisor, then chat or ask for a call-back (DIS-15). The advisors and their answers are made up. */
export function AdvisorsScreen() {
  const [speciality, setSpeciality] = useState('')
  const [language, setLanguage] = useState('')
  const [pick, setPick] = useState<string>(ADVISORS[0].id)
  const [way, setWay] = useState<AdvisorWay>('chat')
  const [phone, setPhone] = useState('')
  const [question, setQuestion] = useState('')
  const list = useMine(() => api.ahead.advisors.list())
  const ask = useAction(async () => { await api.ahead.advisors.ask({ advisorId: pick, way, phone, question }); setQuestion(''); list.retry() })
  const shown = advisorsFor({ speciality: speciality as never, language })
  return (
    <div className="page">
      <h1>{t('route.advisors')}</h1>
      <p>{t('adv.intro')}</p>
      <ChildNote />
      <div className="ab-controls">
        <div className="field">
          <label htmlFor="adv-spec">{t('adv.speciality')}</label>
          <select id="adv-spec" className="field__input" value={speciality} onChange={(e) => setSpeciality(e.target.value)}>
            <option value="">{t('adv.any')}</option>
            {ADVISOR_SPECIALITIES.map((s) => <option key={s} value={s}>{t(`adv.spec.${s}` as StringKey)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="adv-lang">{t('adv.language')}</label>
          <select id="adv-lang" className="field__input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">{t('adv.any')}</option>
            {ADVISOR_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      {shown.length === 0 ? <p>{t('adv.none')}</p> : (
        <fieldset>
          <legend>{t('adv.choose')}</legend>
          <ul className="card-grid">
            {shown.map((a) => (
              <li key={a.id}>
                <Card>
                  <label className="choice choice--top">
                    <input type="radio" name="advisor" checked={pick === a.id} onChange={() => setPick(a.id)} />
                    <span>{a.name}<small>{a.agency}, {a.region}</small><small>{t(`adv.spec.${a.speciality}` as StringKey)} · {a.languages.join(', ')}</small><small>{a.hours}</small></span>
                  </label>
                </Card>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void ask.run() }}>
        <fieldset>
          <legend>{t('adv.how')}</legend>
          {(['chat', 'callback'] as const).map((w) => (
            <label key={w} className="choice">
              <input type="radio" name="adv-way" checked={way === w} onChange={() => setWay(w)} />
              {t(`adv.way.${w}` as StringKey)}
            </label>
          ))}
        </fieldset>
        {way === 'callback' && <Field label={t('adv.phone')} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        <TextArea label={t('adv.question')} hint={t('adv.questionHint')} value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} />
        <AheadError error={ask.error} />
        <Button type="submit" disabled={ask.busy}>{way === 'chat' ? t('adv.send') : t('adv.callMe')}</Button>
      </form>
      <h2>{t('adv.yours')}</h2>
      <Load state={list}>
        {(rows) => rows.length === 0 ? <p className="muted">{t('adv.noneYet')}</p> : (
          <ul className="card-grid">
            {rows.map((r) => (
              <li key={r.id}>
                <Card>
                  <h3 className="card__title">{r.advisor}</h3>
                  <p className="muted">{formatDateTime(r.at)}</p>
                  <p>{r.question}</p>
                  {r.reply && <blockquote>{r.reply}</blockquote>}
                  {r.callbackBy !== null && <p><StatusBadge kind="waitlist" label={t('adv.callBy', { time: formatDateTime(r.callbackBy) })} /></p>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Load>
      <p className="muted">{t('adv.concept')}</p>
      <Back to="/" label={t('route.home')} />
    </div>
  )
}

function Channel({ channel, reload, region }: { channel: MarketingChannel; reload: () => void; region: (typeof CONSENT_REGIONS)[number]['id'] }) {
  const view = useMine(() => api.ahead.marketing.view())
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const subscribe = useAction(async () => { await api.ahead.marketing.subscribe(channel, contact, region); setContact(''); view.retry(); reload() })
  const confirm = useAction(async () => { await api.ahead.marketing.confirm(channel, code); setCode(''); view.retry(); reload() })
  const withdraw = useAction(async () => { await api.ahead.marketing.withdraw(channel); view.retry(); reload() })
  return (
    <Load state={view}>
      {(v) => {
        const c = v.choices.find((x) => x.channel === channel)!
        return (
          <Card>
            <h3 className="card__title">{t(`mkt.channel.${channel}` as StringKey)}</h3>
            {c.state === 'confirmed' && (
              <>
                <p><StatusBadge kind="booked" label={t('mkt.on', { contact: c.contact })} /></p>
                <Button variant="secondary" disabled={withdraw.busy || !v.canEdit} onClick={() => void withdraw.run()}>{t('mkt.stop')}</Button>
              </>
            )}
            {c.state === 'pending' && (
              <>
                <p><StatusBadge kind="waitlist" label={t('mkt.pending', { contact: c.contact })} /></p>
                <p className="muted">{t('mkt.demoCode', { code: c.demoCode ?? '' })}</p>
                <form onSubmit={(e) => { e.preventDefault(); void confirm.run() }}>
                  <Field label={t('mkt.code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
                  <Button type="submit" disabled={confirm.busy || !v.canEdit}>{t('mkt.confirm')}</Button>{' '}
                  <Button variant="tertiary" disabled={withdraw.busy} onClick={() => void withdraw.run()}>{t('mkt.cancel')}</Button>
                </form>
              </>
            )}
            {(c.state === 'none' || c.state === 'expired') && (
              <form onSubmit={(e) => { e.preventDefault(); void subscribe.run() }}>
                {c.state === 'expired' && <p role="status">{t('mkt.expired')}</p>}
                <Field label={t(`mkt.contact.${channel}` as StringKey)} type={channel === 'email' ? 'email' : 'tel'} autoComplete={channel === 'email' ? 'email' : 'tel'} value={contact} onChange={(e) => setContact(e.target.value)} />
                <Button type="submit" disabled={subscribe.busy || !v.canEdit}>{doubleOptInFor(region) ? t('mkt.send') : t('mkt.subscribe')}</Button>
              </form>
            )}
            <AheadError error={subscribe.error ?? confirm.error ?? withdraw.error} />
          </Card>
        )
      }}
    </Load>
  )
}

/** Marketing messages are off until the guest turns them on; where the law asks for it, a second step confirms (DIS-16). */
export function MarketingScreen() {
  const [settings] = useSettings()
  const [, setTick] = useState(0)
  const double = doubleOptInFor(settings.region)
  return (
    <div className="page">
      <h1>{t('route.marketing')}</h1>
      <p>{t('mkt.intro')}</p>
      <ChildNote />
      <Banner kind="info" title={t(`settings.region.${settings.region}` as StringKey)}>
        <p>{double ? t('mkt.double') : t('mkt.single')}</p>
        <p className="muted">{t('mkt.regionHint')}</p>
      </Banner>
      <ul className="card-grid">
        {(['email', 'sms'] as const).map((c) => <li key={c}><Channel channel={c} region={settings.region} reload={() => setTick((n) => n + 1)} /></li>)}
      </ul>
      <p className="muted">{t('mkt.essential')}</p>
      <Back to="/me" label={t('route.me')} />
    </div>
  )
}

/** Help booking for someone, and a gentle way to cancel after a death or serious illness (SUP-07). */
export function AssistScreen() {
  const [kind, setKind] = useState<AssistKind>('assistedBooking')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const list = useMine(() => api.ahead.assist.list())
  const ask = useAction(async () => { await api.ahead.assist.ask({ kind, phone, note }); setNote(''); list.retry() })
  const choose = useAction(async (id: string, choice: 'refund' | 'credit') => { await api.ahead.assist.choose(id, choice); list.retry() })
  return (
    <div className="page">
      <h1>{t('route.assist')}</h1>
      <p>{t('asst.intro')}</p>
      <ChildNote />
      <form onSubmit={(e) => { e.preventDefault(); void ask.run() }}>
        <fieldset>
          <legend>{t('asst.what')}</legend>
          {ASSIST_KINDS.map((k) => (
            <label key={k} className="choice choice--top">
              <input type="radio" name="assist-kind" checked={kind === k} onChange={() => setKind(k)} />
              <span>{t(`asst.kind.${k}` as StringKey)}<small>{t(`asst.kindBody.${k}` as StringKey)}</small></span>
            </label>
          ))}
        </fieldset>
        <Field label={t('asst.phone')} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextArea label={t('asst.note')} hint={t(`asst.noteHint.${kind}` as StringKey)} value={note} maxLength={600} onChange={(e) => setNote(e.target.value)} />
        <AheadError error={ask.error} />
        <Button type="submit" disabled={ask.busy}>{t('asst.send')}</Button>
      </form>
      <p className="muted">{t('asst.helper')}</p>
      <h2>{t('asst.yours')}</h2>
      <AheadError error={choose.error} />
      <Load state={list}>
        {(rows) => rows.length === 0 ? <p className="muted">{t('asst.none')}</p> : (
          <ul className="card-grid">
            {rows.map((r) => (
              <li key={r.id}>
                <Card>
                  <h3 className="card__title">{t(`asst.kind.${r.kind}` as StringKey)} · {r.reference}</h3>
                  <p><StatusBadge kind={r.stage === 'decided' ? 'booked' : 'waitlist'} label={t(`asst.stage.${r.stage}` as StringKey)} /></p>
                  <p className="muted">{formatDateTime(r.at)} · {r.phone}</p>
                  {r.terms && (
                    <>
                      <p>{t('asst.terms', { refund: formatMoney(r.terms.refund), credit: formatMoney(r.terms.credit) })}</p>
                      {r.choice ? <p role="status">{t(`asst.chose.${r.choice}` as StringKey)}</p> : (
                        <div className="button-row">
                          <Button variant="secondary" disabled={choose.busy} onClick={() => void choose.run(r.id, 'refund')}>{t('asst.refund')}</Button>
                          <Button variant="secondary" disabled={choose.busy} onClick={() => void choose.run(r.id, 'credit')}>{t('asst.credit')}</Button>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Load>
      <Back to="/me" label={t('route.me')} />
    </div>
  )
}
