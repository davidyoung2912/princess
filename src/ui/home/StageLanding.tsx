import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { t, th, type StringKey } from '../../i18n'
import { hasWelcomeCopy } from '../../routes/stageWelcome'
import { Link } from 'react-router'
import { Card } from '../Card'
import { StanleyPose } from '../StanleyPose'
import { poseForStage } from '../../routes/stageMood'

/**
 * The landing card: what matters most to this guest right now, from their journey stage and the day of it, The one thing to do next is the guide's "Do this now", just below, so the two never differ.
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
      {hasWelcomeCopy(stage) && <p><Link to="/welcome">{t('welcome.overview')}</Link></p>}
    </Card>
  )
}

