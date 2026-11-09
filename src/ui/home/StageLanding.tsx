import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { t, th, type StringKey } from '../../i18n'
import { STAGE_ACTION } from '../../routes/hubs'
import { hasWelcomeCopy } from '../../routes/stageWelcome'
import { Link } from 'react-router'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { StanleyPose } from '../StanleyPose'
import { poseForStage } from '../../routes/stageMood'

/**
 * The landing card: what matters most to this guest right now, from their journey stage and the day of it, with the one thing to do next.
 * It is the first thing on Home, which is where sign-in and every change of the testing date land.
 */
export function StageLanding() {
  const { stage, day } = useJourneyPosition()
  const where = day?.kind === 'daysToDeparture' ? t('land.toBoarding', { count: day.days }) : null
  return (
    <Card hero labelledBy="landing-h">
      <span className="landing-pose calm-hide"><StanleyPose pose={poseForStage(stage)} size={72} /></span>
      <p className="muted">{t('land.label')}{where && <> · {where}</>}</p>
      <h2 id="landing-h" className="card__title">{th(`land.title.${stage}` as StringKey)}</h2>
      <p>{t(`land.body.${stage}` as StringKey)}</p>
      <div className="button-row"><LinkButton to={STAGE_ACTION[stage]}>{t(`land.go.${stage}` as StringKey)}</LinkButton></div>
      {hasWelcomeCopy(stage) && <p><Link to="/welcome">{t('welcome.overview')}</Link></p>}
    </Card>
  )
}

