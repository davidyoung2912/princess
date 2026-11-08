import { GUEST_SERVICES_NUMBER } from '../domain/contacts'
import { t, th } from '../i18n'
import { Dialog } from './Dialog'
import { DialogHeader } from './DialogHeader'
import { Button, LinkButton } from './Button'
import { coachCanReplay, hasCoach } from '../ai/stanleyMoments'
import { useSettings } from '../hooks/useSettings'
import { requestReplay } from '../settings/stanleySeen'
import { stanleyLevelFor } from '../settings/settings'
import { Help, Phone, Siren } from './icons'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { visibleAt } from '../routes/screenWords'
import { UrgentIssues } from './onboard/UrgentIssues'

/**
 * The help sheet reachable from the top bar on every screen (requirement SUP-08). Everything in it works offline:
 * the phone numbers are plain text and `tel:` links, and nothing depends on chat being up.
 */
export function HelpSheet({ onClose, screenId, onAskStanley }: { onClose: () => void; screenId?: string; onAskStanley?: () => void }) {
  const [settings] = useSettings()
  const { stage } = useJourneyPosition()
  const tour = hasCoach(screenId) && coachCanReplay(stanleyLevelFor(settings))
  return (
    <Dialog title={t('help.title')} onClose={onClose} header={(titleId) => <DialogHeader titleId={titleId} title={t('help.title')} subtext={t('help.intro')} icon={Help} onClose={onClose} />}>
      <div className="stack">
        <section className="card card--info" aria-labelledby="help-call-h">
          <h3 id="help-call-h"><Phone aria-hidden="true" /> {th('help.call')}</h3>
          <p>{t('help.callNumber', { number: GUEST_SERVICES_NUMBER })}</p>
          <a className="btn btn--primary btn--block" href={`tel:${GUEST_SERVICES_NUMBER}`}>{GUEST_SERVICES_NUMBER}</a>
        </section>
        <section aria-labelledby="help-page-h" className="stack">
          <h3 id="help-page-h">{th('help.page')}</h3>
          {visibleAt(stage, '/ship/read-aloud') && <LinkButton to="/ship/read-aloud" variant="secondary" block onClick={onClose}>{t('help.readAloud')}</LinkButton>}
          {visibleAt(stage, '/home/summary') && <LinkButton to="/home/summary" variant="secondary" block onClick={onClose}>{t('help.plain')}</LinkButton>}
          {onAskStanley && <Button variant="secondary" block onClick={() => { onClose(); onAskStanley() }}>{t('help.askStanley')}</Button>}
        </section>
        {tour && <Button variant="secondary" block onClick={() => { requestReplay(`coach:${screenId}`); onClose() }}>{t('stanley.coach.replay')}</Button>}
        <LinkButton to="/chat" variant="secondary" block onClick={onClose}>{t('help.chat')}</LinkButton>
        <section className="card" aria-labelledby="help-emergency-h">
          <h3 id="help-emergency-h"><Siren aria-hidden="true" /> {th('help.emergency')}</h3>
          <p>{t('help.emergencyText')}</p>
          <p className="muted">{t('help.medical')}</p>
          <LinkButton to="/ship/emergency" variant="secondary" block onClick={onClose}>{t('help.card')}</LinkButton>
        </section>
        <UrgentIssues headingId="help-urgent-h" />
      </div>
      <p className="muted">{t('help.sample')}</p>
    </Dialog>
  )
}
