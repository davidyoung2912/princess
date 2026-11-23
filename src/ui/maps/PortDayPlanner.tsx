import { useId, useMemo, useState } from 'react'
import { t } from '../../i18n'
import type { GuideAttraction } from '../../domain/portGuide'
import { isLatLng, type Pace } from '../../maps/geo'
import { planPortDay, type Candidate } from '../../maps/portDay'
import { PlaceMap } from './PlaceMap'

/**
 * "Plan my port day": a walking plan for the call, chosen from the port guide's places and timed against the ship's published arrival and all-aboard times.
 * It is a suggestion made on the phone from the guide's data, not a booking, and the ship's notice on the day has the last word on the time to be back.
 */
export function PortDayPlanner({ attractions, arrive, allAboard, tender }: { attractions: readonly GuideAttraction[]; arrive: string; allAboard: string; tender: boolean }) {
  const uid = useId()
  const [pace, setPace] = useState<Pace>('steady')
  const [meal, setMeal] = useState(false)
  const candidates = useMemo<Candidate[]>(() => attractions.filter((a) => a.map && isLatLng(a.map)).map((a) => ({ id: a.name, name: a.name, at: a.map!, tier: a.tier, why: a.why })), [attractions])
  const plan = useMemo(() => planPortDay({ candidates, arrive, allAboard, tender, pace, mealMinutes: meal ? 60 : 0 }), [candidates, arrive, allAboard, tender, pace, meal])
  if (candidates.length < 2) return null

  return (
    <section aria-labelledby={`${uid}-h`} className="port-day">
      <h3 id={`${uid}-h`}>{t('portday.title')}</h3>
      <p className="muted">{t('portday.intro', { arrive, allAboard })}</p>
      <fieldset className="port-day__options">
        <legend>{t('portday.pace')}</legend>
        <label className="choice"><input type="radio" name={`${uid}-pace`} checked={pace === 'steady'} onChange={() => setPace('steady')} /><span>{t('portday.pace.steady')}</span></label>
        <label className="choice"><input type="radio" name={`${uid}-pace`} checked={pace === 'easy'} onChange={() => setPace('easy')} /><span>{t('portday.pace.easy')}</span></label>
      </fieldset>
      <label className="choice"><input type="checkbox" checked={meal} onChange={(e) => setMeal(e.target.checked)} /><span>{t('portday.meal')}</span></label>

      <div role="status" aria-live="polite">
        {plan.reason === 'noTime' && <p>{t('portday.noTime')}</p>}
        {plan.reason === 'fewPlaces' && <p>{t('portday.fewPlaces')}</p>}
      </div>
      {plan.reason === null && (
        <>
          <p><strong>{t('portday.summary', { stops: plan.stops.length, walking: plan.walking, headBack: plan.headBackBy, allAboard: plan.allAboard })}</strong></p>
          <ol className="port-day__timeline">
            {plan.stops.map((s, i) => (
              <li key={s.id}>
                <strong>{s.arriveAt}</strong> {s.name}
                <span className="muted"> · {i === 0 ? t('portday.first') : t('portday.walk', { minutes: s.walkFromPrevious })}</span>
              </li>
            ))}
            {meal && <li><strong>{plan.stops[plan.stops.length - 1].leaveAt}</strong> <span className="muted">{t('portday.mealNote')}</span></li>}
            <li><strong>{plan.headBackBy}</strong> {t('portday.headBack', { minutes: plan.returnWalk })}</li>
          </ol>
          <PlaceMap title={t('portday.mapTitle')} pins={plan.stops.map((s) => ({ id: s.id, label: s.name, at: s.at }))} route pace={pace} />
          <p className="muted">{t('portday.spare', { minutes: plan.spare })}</p>
        </>
      )}
      <p className="muted">{t('portday.caveat')}</p>
    </section>
  )
}

