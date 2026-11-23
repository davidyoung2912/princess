import { Link } from 'react-router'
import { readPackResult } from '../../data/capsule'
import { packNudge } from '../../domain/packNudge'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { useNow } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'

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
