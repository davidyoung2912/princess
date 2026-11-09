import { LinkButton } from './Button'
import { Card } from './Card'
import { t } from '../i18n'
import { relativeIn } from '../domain/homeLook'
import { relativeText } from './relativeText'
import type { Moment } from '../domain/homeLook'

const GO = { 'moment.muster': 'moment.muster.go', 'moment.allAboard': 'moment.allAboard.go', 'moment.payment': 'moment.payment.go', 'moment.checkinOpen': 'moment.checkinOpen.go', 'moment.checkinSoon': 'moment.checkinSoon.go' } as const

/** "The Moment": the one thing that matters now, with one button. Urgent ones also say so in words. */
export function MomentCard({ moment }: { moment: Moment }) {
  return (
    <Card hero labelledBy="moment-h">
      <p className="muted">{t('land.label')}</p>
      <h2 id="moment-h" className="card__title">{moment.urgent && <span className="visually-hidden">{t('stage.tile.attention')}: </span>}{t(moment.key, moment.vars)}</h2>
      {moment.key === 'moment.allAboard' && <p><strong>{relativeText(relativeIn(Number(moment.vars.count) * 60_000)!)}</strong></p>}
      <div className="button-row"><LinkButton to={moment.to}>{t(GO[moment.key])}</LinkButton></div>
    </Card>
  )
}
