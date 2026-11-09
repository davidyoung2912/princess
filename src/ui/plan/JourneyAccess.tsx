import { useState } from 'react'
import { needsStepFree, type AccessProfile } from '../../domain/bookingPrep'
import { answerOf, AREAS, FEATURES, filterJourney, journeyItems, journeySummary, type Answer, type Feature } from '../../domain/journeyAccess'
import { useCatalogue } from '../../hooks/useCatalogue'
import { t, th, type StringKey } from '../../i18n'
import { Card } from '../Card'

const mark = (a: Answer): string => t(`jacc.answer.${a}` as StringKey)

/** One accessibility filter and one comparison across ship, cabin, port and excursion; anything not stated shows as unknown (DRM-10, DSC-11). */
export function JourneyAccess({ access }: { access: AccessProfile }) {
  useCatalogue()
  const [chosen, setChosen] = useState<Feature[]>(() => (needsStepFree(access) ? ['stepFree'] : []))
  const items = journeyItems()
  const shown = filterJourney(items, chosen)
  const summary = journeySummary(items, chosen)
  const toggle = (f: Feature) => setChosen((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]))
  const features = chosen.length > 0 ? chosen : FEATURES
  return (
    <section aria-labelledby="jacc-h">
      <h2 id="jacc-h">{th('jacc.title')}</h2>
      <p>{t('jacc.intro')}</p>
      <div className="workspace">
      <fieldset className="workspace__side">
        <legend>{t('jacc.need')}</legend>
        {FEATURES.map((f) => <label key={f} className="choice"><input type="checkbox" checked={chosen.includes(f)} onChange={() => toggle(f)} /><span>{t(`jacc.feature.${f}` as StringKey)}</span></label>)}
      </fieldset>
      <div className="workspace__main">
      <table>
        <caption>{t('jacc.summary')}</caption>
        <thead><tr><th scope="col">{t('jacc.col.area')}</th><th scope="col">{t('jacc.col.yes')}</th><th scope="col">{t('jacc.col.unknown')}</th><th scope="col">{t('jacc.col.no')}</th></tr></thead>
        <tbody>{summary.map((s) => <tr key={s.area}><th scope="row">{t(`jacc.area.${s.area}` as StringKey)}</th><td>{s.yes}</td><td>{s.unknown}</td><td>{s.no}</td></tr>)}</tbody>
      </table>
      {AREAS.map((area) => {
        const rows = shown.filter((i) => i.area === area)
        return (
          <Card key={area} labelledBy={`jacc-${area}`}>
            <h3 id={`jacc-${area}`} className="card__title">{th(`jacc.area.${area}` as StringKey)}</h3>
            {rows.length === 0 ? <p className="muted">{t('jacc.none')}</p> : (
              <ul className="plain-list">
                {rows.map((i) => (
                  <li key={i.id}>
                    <span><strong>{i.name}</strong>{i.detail && <><br /><span className="muted">{i.detail}</span></>}</span>
                    <span>{features.map((f) => { const a = answerOf(i, f); return <span key={f} className={a === 'unknown' ? 'badge badge--warn' : 'badge'}>{t(`jacc.feature.${f}` as StringKey)}: {mark(a)} </span> })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}
      <p className="muted">{t('jacc.note')}</p>
      </div>
      </div>
    </section>
  )
}
