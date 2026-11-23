import { PathLinkList } from '../../../shared/ui/ScreenList'
import { useRebookGate } from '../../../shared/hooks/useRebookGate'
import { RebookCaseNote } from '../../stanley/ui/StanleyRemember'
import { asNightView } from '../../../shared/api/guards'
import { nextNightItem } from '../../../domain/disembark'
import { api } from '../../../app/runtime'
import { usePersona } from '../../../shared/hooks/useDemo'
import { useSavedCopy } from '../../../shared/hooks/useSavedCopy'
import { t, th, type StringKey } from '../../../shared/i18n'
import { LinkButton } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { Saved } from '../../onboard/ui/common'
import { useShipTime } from '../../onboard/ui/shipTime'
import { useReached, useSailed } from '../../../shared/hooks/useStage'

/** On the last day aboard: the next thing to do before the morning, and the way to the disembarkation plan (DEB-01, DEB-07). */
export function DisembarkCard() {
  return useReached('farewell') ? <DisembarkNext /> : null
}

function DisembarkNext() {
  const me = usePersona()
  const night = useSavedCopy('night', me?.booker ?? 'none', () => api.disembark.night(), asNightView, [me?.id])
  const shipTime = useShipTime()
  return (
    <Card hero labelledBy="home-dis-h">
      <h2 id="home-dis-h" className="card__title">{th('route.disembark')}</h2>
      <Saved copy={night}>
        {(v) => {
          const next = nextNightItem(v.entries)
          return <p>{next ? t('night.next', { what: t(`night.item.${next.id}` as StringKey), time: shipTime(next.dueAt) }) : t('night.allDone')}</p>
        }}
      </Saved>
      <div className="button-row">
        <LinkButton to="/home/disembark">{t('route.disembark')}</LinkButton>
        <LinkButton to="/home/disembark/final-night" variant="secondary">{t('route.finalNight')}</LinkButton>
      </div>
    </Card>
  )
}

/** After you have left the ship: rate the cruise, see rewards, and book the next one. Not offered on the last evening (UX-02). */
export function AfterCruiseCard() {
  const sailed = useSailed()
  const gate = useRebookGate()
  if (!sailed) return null
  return (
    <Card hero labelledBy="home-after-h">
      <h2 id="home-after-h" className="card__title">{th('home.after')}</h2>
      <p>{t('home.afterBody')}</p>
      <RebookCaseNote gate={gate} />
      <PathLinkList items={[{ path: '/me/feedback' }, { path: '/me/bill/final' }, { path: '/me/cases' }, { path: '/me/loyalty' }, gate?.mode !== 'hold' && { path: '/me/rebook' }, { path: '/me/recap' }, { path: '/me/history' }]} />
    </Card>
  )
}
