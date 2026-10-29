import { Link } from 'react-router'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { Card } from '../Card'

const BRING = ['passport', 'booking', 'card', 'contact'] as const
const STEPS = ['arrive', 'desk', 'photo', 'lane', 'board'] as const

/** If you did not finish online (CHK-08): what to expect at the terminal, in the order it happens, so nobody is turned away by surprise. */
export function TerminalScreen() {
  return (
    <div className="page">
      <h1>{t('route.terminalCheckin')}</h1>
      <p>{t('terminal.intro')}</p>
      <Banner kind="success" title={t('terminal.reassure')}><p>{t('terminal.reassureBody')}</p></Banner>

      <section aria-labelledby="bring-h">
        <h2 id="bring-h">{t('terminal.bring')}</h2>
        <ul className="plain-bullets">{BRING.map((k) => <li key={k}>{t(`terminal.bring.${k}` as StringKey)}</li>)}</ul>
      </section>

      <section aria-labelledby="expect-h">
        <h2 id="expect-h">{t('terminal.expect')}</h2>
        <ol className="plain-bullets">{STEPS.map((k) => <li key={k}><strong>{t(`terminal.step.${k}` as StringKey)}</strong> {t(`terminal.step.${k}.body` as StringKey)}</li>)}</ol>
      </section>

      <Card info>
        <h2 className="card__title">{t('terminal.blue')}</h2>
        <p>{t('terminal.blueBody')}</p>
        <p className="muted">{t('terminal.wait')}</p>
      </Card>

      <div className="button-row">
        <LinkButton to="/home/check-in">{t('terminal.tryOnline')}</LinkButton>
        <LinkButton to="/home/embarkation" variant="secondary">{t('route.embarkation')}</LinkButton>
      </div>
      <p><Link to="/me/contact">{t('terminal.help')}</Link></p>
    </div>
  )
}
