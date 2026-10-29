import { t } from '../i18n'
import { Dialog } from './Dialog'
import { LinkButton } from './Button'
import { Phone, Siren } from './icons'

/** Sample numbers for the concept; the mock ship data supplies the real ones in Phase 6. 555-01xx numbers are reserved for fiction. */
const GUEST_SERVICES_NUMBER = '555-0100'

/**
 * The help sheet reachable from the top bar on every screen (requirement SUP-08). Everything in it works offline:
 * the phone numbers are plain text and `tel:` links, and nothing depends on chat being up.
 */
export function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title={t('help.title')} onClose={onClose}>
      <p>{t('help.intro')}</p>
      <div className="stack">
        <section className="card card--info" aria-labelledby="help-call-h">
          <h3 id="help-call-h"><Phone aria-hidden="true" /> {t('help.call')}</h3>
          <p>{t('help.callNumber', { number: GUEST_SERVICES_NUMBER })}</p>
          <a className="btn btn--primary btn--block" href={`tel:${GUEST_SERVICES_NUMBER}`}>{GUEST_SERVICES_NUMBER}</a>
        </section>
        <LinkButton to="/chat" variant="secondary" block onClick={onClose}>{t('help.chat')}</LinkButton>
        <section className="card" aria-labelledby="help-emergency-h">
          <h3 id="help-emergency-h"><Siren aria-hidden="true" /> {t('help.emergency')}</h3>
          <p>{t('help.emergencyText')}</p>
          <p className="muted">{t('help.medical')}</p>
        </section>
      </div>
      <p className="muted">{t('help.sample')}</p>
    </Dialog>
  )
}
