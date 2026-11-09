import { Link } from 'react-router'
import { useJourneyStage } from '../hooks/useJourneyStage'
import { t, th } from '../i18n'
import { voyagePosition } from '../domain/homeLook'
import { JOURNEY_STAGES, STAGE_ACTION } from '../routes/hubs'

/** The eleven stages of the trip with the current one marked, and the one thing to do for it (N2.1). */
export function JourneyStrip() {
  const stage = useJourneyStage()
  const action = STAGE_ACTION[stage]
  const pos = voyagePosition(stage)
  return (
    <section aria-labelledby="journey-h" className="journey">
      <h2 id="journey-h" className="visually-hidden">{th('journey.title')}</h2>
      <div className="voyage" aria-hidden="true"><span className="voyage__route" /><span className="voyage__done" style={{ width: `${pos.percent}%` }} /><span className="voyage__ship" style={{ insetInlineStart: `${pos.percent}%` }} /></div>
      <p className="visually-hidden">{t('journey.shipHere', { n: pos.index + 1, total: pos.total })}</p>
      <ol className="journey-strip">
        {JOURNEY_STAGES.map((s) => (
          <li key={s} aria-current={s === stage ? 'step' : undefined} className={s === stage ? 'journey-strip__now' : undefined}>
            {t(`journey.stage.${s}`)}{s === stage && <span className="visually-hidden"> {t('journey.here')}</span>}
          </li>
        ))}
      </ol>
      <p className="journey__next">{t('journey.next')} <Link to={action}>{t(`journey.go.${stage}`)}</Link></p>
    </section>
  )
}
