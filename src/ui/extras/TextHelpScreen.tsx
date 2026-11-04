import { useCatalogue } from '../../hooks/useCatalogue'
import { useState } from 'react'
import { Link } from 'react-router'
import { EMERGENCY_NUMBER } from '../../domain/contacts'
import { DECKS, placesOnDeck } from '../../domain/deck'
import { itemDays, itemsIn } from '../../domain/catalogue'
import { itinerary } from '../../domain/sailings'
import { RESPONSE_MINUTES, TEXT_HELP_MAX, textHelpProblem } from '../../domain/health'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona, useSailing } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, th } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Phone, Siren } from '../icons'
import { BackLink } from '../onboard/common'
import { duration, useShipTime } from '../onboard/shipTime'
import { ExtraError } from './common'

/**
 * Ask for help by text (N5.6, XI-07): a written message to Guest Services for a guest who cannot speak or hear on the phone. It is not an alarm.
 * The wording puts the alarm, the emergency number and the nearest crew member first, says how long a reply usually takes, and says plainly
 * when a message has not been sent. Interpreter times for signed shows are listed from the catalogue.
 */
export function TextHelpScreen() {
  useCatalogue()
  const me = usePersona()
  const health = useMine(() => api.health.view(), [])
  const shipTime = useShipTime()
  const [where, setWhere] = useState('')
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<'empty' | 'tooLong' | null>(null)
  const [sent, setSent] = useState(false)
  const send = useAction(async () => {
    const place = where ? ` [${t('txt.at')}: ${where}]` : ''
    await api.health.request('textHelp', `${text.trim()}${place}`.slice(0, TEXT_HELP_MAX))
    setText('')
    setSent(true)
    health.retry()
  })
  const sailing = useSailing()
  const signed = itemsIn('access').filter((i) => i.support?.includes('signed'))
  const mine = (health.data?.requests ?? []).filter((r) => r.kind === 'textHelp')
  const submit = () => {
    setSent(false)
    const p = textHelpProblem(text)
    setProblem(p)
    if (!p) void send.run()
  }
  return (
    <div className="page">
      <Banner kind="warning" title={t('txt.urgentTitle')}>
        <p>{t('txt.urgentBody')}</p>
        <a className="btn btn--danger btn--block" href={`tel:${EMERGENCY_NUMBER}`}><Phone aria-hidden="true" /> {th('help.callEmergency', { number: EMERGENCY_NUMBER })}</a>
        <p><Link to="/ship/emergency"><Siren aria-hidden="true" /> {t('route.emergency')}</Link></p>
      </Banner>

      {me?.child ? <p className="muted">{t('plan.readOnly.body')}</p> : (
        <Card labelledBy="txt-h">
          <h2 id="txt-h" className="card__title">{th('txt.title')}</h2>
          <p>{t('txt.intro', { time: duration(RESPONSE_MINUTES.textHelp) })}</p>
          <form onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
            <div className="field">
              <label htmlFor="txt-where">{t('txt.where')}</label>
              <select id="txt-where" className="field__input" value={where} onChange={(e) => setWhere(e.target.value)}>
                <option value="">{t('txt.whereCabin')}</option>
                {DECKS.slice().reverse().map((d) => <optgroup key={d} label={t('map.deck', { deck: d })}>{placesOnDeck(d).map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</optgroup>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="txt-msg">{t('txt.message')}</label>
              <p className="field__hint" id="txt-hint">{t('txt.messageHint', { max: TEXT_HELP_MAX })}</p>
              <textarea id="txt-msg" className="field__input" rows={4} maxLength={TEXT_HELP_MAX} value={text} aria-describedby="txt-hint" aria-invalid={problem ? true : undefined} onChange={(e) => setText(e.target.value)} />
              {problem && <p role="alert" className="field__error">{t(problem === 'empty' ? 'txt.empty' : 'txt.tooLong', { max: TEXT_HELP_MAX })}</p>}
            </div>
            <ExtraError error={send.error} />
            {send.error && <p role="alert"><strong>{t('txt.notSent')}</strong></p>}
            <Button type="submit" disabled={send.busy}>{send.busy ? t('account.saving') : t('txt.send')}</Button>
            {sent && <Banner kind="success" title={t('txt.sentTitle')}><p>{t('txt.sentBody', { time: duration(RESPONSE_MINUTES.textHelp) })}</p></Banner>}
          </form>
          {mine.length > 0 && (
            <>
              <h3>{th('txt.history')}</h3>
              <ul className="plain-bullets">{mine.map((r) => <li key={r.id}>{shipTime(r.at)}: {r.note}</li>)}</ul>
            </>
          )}
        </Card>
      )}

      <section aria-labelledby="txt-sign-h">
        <h2 id="txt-sign-h">{th('txt.interpreters')}</h2>
        <p>{t('txt.interpretersBody')}</p>
        <ul className="plain-bullets">
          {signed.map((i) => <li key={i.id}>{t('txt.signedAt', { title: i.title, days: itemDays(i, itinerary(sailing)).join(', '), time: i.times.join(', ') })}</li>)}
        </ul>
        <p><Link to="/ship/access">{t('route.access')}</Link> · <Link to="/plan/assistance">{t('route.assistance')}</Link></p>
      </section>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}
