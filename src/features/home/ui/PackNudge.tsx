import { Link } from 'react-router'
import { readPackResult } from '../../../shared/data/capsule'
import { packNudge } from '../../../domain/packNudge'
import { useJourneyPosition } from '../../../shared/hooks/useJourneyPosition'
import { useNow } from '../../../shared/hooks/useDemo'
import { t, type StringKey } from '../../../shared/i18n'
import { Card } from '../../../shared/ui/Card'

/** A plain reminder, shown only close to sailing, to put the cruise on the phone while there is a signal. It is a task help, not an offer. */
export function PackNudge() {
  const { stage } = useJourneyPosition()
  const now = useNow()
  const nudge = packNudge(stage, readPackResult(), now)
  if (nudge === 'none') return null
  return (
    <Card info labelledBy="pack-nudge-h">
      <h2 id="pack-nudge-h" className="card__title">{t(`packnudge.${nudge}.title` as StringKey)}</h2>
      <p>{t(`packnudge.${nudge}.body` as StringKey)} <Link to="/plan/phone">{t('packnudge.go')}</Link></p>
    </Card>
  )
}
