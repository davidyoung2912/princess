import { useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router'
import { getContext, subscribeContext } from '../../account/context'
import { recordJourney } from '../../runtime'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'

const BRING = ['passport', 'booking', 'card', 'contact'] as const
const STEPS = ['arrive', 'desk', 'photo', 'lane', 'board'] as const

/** If you did not finish online (CHK-08): what to expect at the terminal, in the order it happens, so nobody is turned away by surprise. */
export function TerminalScreen() {
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  const sailingId = context?.booking?.sailingId ?? context?.focusSailingId ?? null
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  // Tells the server the guest is at the terminal, which moves them to Embark; the boarding screens then open.
  const arrived = async () => { setBusy(true); await recordJourney('atTerminal', sailingId); navigate('/home/embarkation') }
  return (
    <div className="page">
      <p>{t('terminal.intro')}</p>
      <Banner kind="success" title={t('terminal.reassure')}><p>{t('terminal.reassureBody')}</p></Banner>

      <section aria-labelledby="bring-h">
        <h2 id="bring-h">{th('terminal.bring')}</h2>
        <ul className="plain-bullets">{BRING.map((k) => <li key={k}>{t(`terminal.bring.${k}` as StringKey)}</li>)}</ul>
      </section>

      <section aria-labelledby="expect-h">
        <h2 id="expect-h">{th('terminal.expect')}</h2>
        <ol className="plain-bullets">{STEPS.map((k) => <li key={k}><strong>{t(`terminal.step.${k}` as StringKey)}</strong> {t(`terminal.step.${k}.body` as StringKey)}</li>)}</ol>
      </section>

      <Card info>
        <h2 className="card__title">{th('terminal.blue')}</h2>
        <p>{t('terminal.blueBody')}</p>
        <p className="muted">{t('terminal.wait')}</p>
      </Card>

      {sailingId && (
        <Card labelledBy="here-h">
          <h2 id="here-h" className="card__title">{th('terminal.here')}</h2>
          <p>{t('terminal.hereBody')}</p>
          <Button onClick={() => void arrived()} disabled={busy}>{t('terminal.hereButton')}</Button>
        </Card>
      )}

      <div className="button-row">
        <LinkButton to="/home/check-in">{t('terminal.tryOnline')}</LinkButton>
        <LinkButton to="/home/embarkation" variant="secondary">{t('route.embarkation')}</LinkButton>
      </div>
      <p><Link to="/me/contact">{t('terminal.help')}</Link></p>
    </div>
  )
}
