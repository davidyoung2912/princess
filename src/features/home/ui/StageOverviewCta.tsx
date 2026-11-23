import { useLocation } from 'react-router'
import { useJourneyPosition } from '../../../shared/hooks/useJourneyPosition'
import { t, th, type StringKey } from '../../../shared/i18n'
import { hasWelcomeCopy } from '../../../app/routes/stageWelcome'
import { LinkButton } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

/** A call to open the stage overview, right under the tip card on Home: what this stage is for, what is left to do and how to move on. */
export function StageOverviewCta() {
  const { stage } = useJourneyPosition()
  const { pathname } = useLocation()
  if (!hasWelcomeCopy(stage)) return null
  const name = t(`journey.stage.${stage}` as StringKey)
  return (
    <div className="page page--tip no-print">
      <Card info labelledBy="stage-cta-h">
        <h2 id="stage-cta-h" className="card__title">{th('stageCta.title', { stage: name })}</h2>
        <p>{t('stageCta.body')}</p>
        <div className="button-row"><LinkButton to="/welcome" state={{ from: pathname }}>{t('stageCta.go')}</LinkButton></div>
      </Card>
    </div>
  )
}
