import { useId, useMemo, useState } from 'react'
import { t } from '../../../shared/i18n'
import type { GuideAttraction } from '../../../domain/portGuide'
import { isLatLng, type Pace } from '../logic/geo'
import { planPortDay, weatherNotes, indoorIdeas, type Candidate } from '../logic/portDay'
import { useSky } from '../../../shared/hooks/useSky'
import { useServedFeed } from '../../../shared/hooks/useServedFeeds'
import { walkingPlanFeed } from '../../../shared/feeds/walkingPlan'
import { PlaceMap } from './PlaceMap'

/**
 * "Plan my port day": a walking plan for the call, chosen from the port guide's places and timed against the ship's published arrival and all-aboard times.
 * It is a suggestion made on the phone from the guide's data, not a booking, and the ship's notice on the day has the last word on the time to be back.
 */
export function PortDayPlanner({ attractions, arrive, allAboard, tender, date, port }: { attractions: readonly GuideAttraction[]; arrive: string; allAboard: string; tender: boolean; /** The call's date (YYYY-MM-DD) and port id, for the weather note. */ date: string; port: string }) {
  const uid = useId()
  const [pace, setPace] = useState<Pace>('steady')
  const [meal, setMeal] = useState(false)
  const sky = useSky(date, port)
  const candidates = useMemo<Candidate[]>(() => attractions.filter((a) => a.map && isLatLng(a.map)).map((a) => ({ id: a.name, name: a.name, at: a.map!, tier: a.tier, why: a.why })), [attractions])
  const local = useMemo(() => planPortDay({ candidates, arrive, allAboard, tender, pace, mealMinutes: meal ? 60 : 0 }), [candidates, arrive, allAboard, tender, pace, meal])
  // The server plans the day from the same guide; the page's own plan stands in while that loads, offline, or if the answer is unusable.
  const served = useServedFeed(candidates.length >= 2, walkingPlanFeed, [port, arrive, allAboard, tender, pace, meal])
  const plan = served ?? local
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
          {sky && (
            <div role="group" aria-label={t('portday.weather')}>
              <h4>{t('portday.weather')}</h4>
              <ul className="plain-bullets">
                {weatherNotes(sky, arrive, allAboard).map((n) => (
                  <li key={n.id}>{n.id === 'rain' ? t('portday.weather.rain', { from: n.from, to: n.to }) : n.id === 'hot' ? t('portday.weather.hot', { temp: n.tempF }) : n.id === 'sun' ? t('portday.weather.sun', { uv: n.uv }) : t('portday.weather.fine', { temp: n.tempF, uv: n.uv })}</li>
                ))}
              </ul>
              {weatherNotes(sky, arrive, allAboard).some((n) => n.id === 'rain') && indoorIdeas(candidates).length > 0 && <p>{t('portday.weather.indoor', { places: indoorIdeas(candidates).join(', ') })}</p>}
            </div>
          )}
        </>
      )}
      <p className="muted">{t('portday.caveat')}</p>
    </section>
  )
}

