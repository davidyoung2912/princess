import { useState } from 'react'
import { Link } from 'react-router'
import { t, type StringKey } from '../../i18n'
import { formatMoney } from '../../domain/money'
import { browseSailings, compareHighlights, portName, rangeOf, sailingFacts, type BrowseSailing } from '../../domain/catalogueBrowse'
import { useCatalogue } from '../../hooks/useCatalogue'
import { useFavourites } from '../../hooks/useFavourites'
import { useMemory } from '../../hooks/useMemory'
import { wantMatches } from '../../domain/rememberDelights'
import { portById } from '../../domain/sailings'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { regionName, shipName } from './catalogueNames'
import { WeightedCompare } from './WeightedCompare'

const MAX = 3

/** Two or three saved sailings side by side: dates, price a person and a night, ports, sea days (H51). Saved sailings are picked with the boxes; nothing is picked for the guest beyond the first three. */
export function CompareSailingsScreen() {
  useCatalogue()
  const favourites = useFavourites()
  const { state } = useMemory()
  const wants = state.remember.wants
  const all = browseSailings()
  const saved = favourites.keys.flatMap((k) => (k.startsWith('sailing:') ? all.filter((s) => s.id === k.slice('sailing:'.length)) : []))
  // Until the guest touches a box, the first three saved sailings are compared.
  const [picked, setPicked] = useState<string[] | null>(null)
  const chosenIds = picked ?? saved.slice(0, MAX).map((s) => s.id)
  const chosen: BrowseSailing[] = saved.filter((s) => chosenIds.includes(s.id))
  const toggle = (id: string) => setPicked(chosenIds.includes(id) ? chosenIds.filter((x) => x !== id) : [...chosenIds, id].slice(0, MAX))
  const facts = chosen.map(sailingFacts)
  const marks = compareHighlights(facts)
  const rows: { key: StringKey; cell: (f: (typeof facts)[number]) => string }[] = [
    { key: 'cat.sailingFact.ship', cell: (f) => shipName(f.ship) },
    { key: 'cat.sailingFact.region', cell: (f) => regionName(f.region) || t('cat.compare.unknown') },
    { key: 'cat.sailingFact.dates', cell: (f) => rangeOf(f) },
    { key: 'cat.sailingFact.nights', cell: (f) => String(f.nights) },
    { key: 'cat.sailingFact.from', cell: (f) => (f.fromCents === undefined ? t('cat.noPrice') : formatMoney(f.fromCents)) },
    { key: 'cat.sailingFact.perNight', cell: (f) => (f.perNightCents === null ? t('cat.noPrice') : formatMoney(f.perNightCents)) },
    { key: 'cat.sailingFact.ports', cell: (f) => (f.ports.length > 0 ? f.ports.map(portName).join(', ') : t('cat.compare.unknown')) },
    ...(wants.length > 0 ? [{ key: 'cat.sailingFact.wanted' as StringKey, cell: (f: (typeof facts)[number]) => {
      const hits = wantMatches(wants, f.ports.map((p) => portById(p)?.name ?? p))
      return hits.length > 0 ? [...new Set(hits.map((h) => h.place))].join('; ') : t('cat.compare.noWanted')
    } }] : []),
    { key: 'cat.sailingFact.seaDays', cell: (f) => (f.seaDays === null ? t('cat.compare.unknown') : String(f.seaDays)) },
    { key: 'cat.sailingFact.holiday', cell: (f) => t(f.holiday ? 'cat.yes' : 'cat.no') },
    { key: 'cat.sailingFact.status', cell: (f) => t(f.bookingOpen ? 'cat.status.open' : f.dataStatus === 'sample' ? 'cat.status.sample' : 'cat.status.browse') },
  ]
  return (
    <div className="page page--wide">
      <p>{t('cat.saved.intro')}</p>
      {!favourites.ready && <p role="status" className="muted">{t('discover.loading')}</p>}
      {favourites.ready && saved.length < 2 && (
        <Card info>
          <p>{t('cat.saved.needTwo')}</p>
          <LinkButton to="/home/sailings">{t('discover.seeDates')}</LinkButton>
        </Card>
      )}
      {saved.length >= 2 && (
        <>
          <fieldset>
            <legend>{t('cat.saved.pick', { max: MAX })}</legend>
            {saved.map((s) => {
              const on = chosen.some((c) => c.id === s.id)
              return (
                <label key={s.id} className="choice">
                  <input type="checkbox" checked={on} disabled={!on && chosen.length >= MAX} onChange={() => toggle(s.id)} />
                  {s.title}, {rangeOf(s)}
                </label>
              )
            })}
          </fieldset>
          {chosen.length < 2 ? <p role="status" className="muted">{t('cat.saved.pickTwo')}</p> : (
            <div className="table-scroll">
              <table className="compare-table">
                <caption>{t('cat.saved.caption', { count: chosen.length })}</caption>
                <thead>
                  <tr>
                    <th scope="col"><span className="visually-hidden">{t('cat.compare.fact')}</span></th>
                    {chosen.map((s) => <th key={s.id} scope="col"><Link to={`/home/sailings/${s.id}`}>{s.title}</Link></th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{t(r.key)}</th>
                      {facts.map((f) => (
                        <td key={f.id}>
                          {r.cell(f)}
                          {r.key === 'cat.sailingFact.perNight' && marks.cheapest.includes(f.id) && <span className="tag tag--good">{t('discover.lowest')}</span>}
                          {r.key === 'cat.sailingFact.nights' && marks.fewestNights.includes(f.id) && <span className="tag">{t('cat.shortest')}</span>}
                          {r.key === 'cat.sailingFact.ports' && marks.mostPorts.includes(f.id) && <span className="tag">{t('cat.mostPorts')}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {chosen.length >= 2 && <WeightedCompare ids={chosen.map((s) => s.id)} />}
        </>
      )}
      <Card info><p>{t('cat.saved.note')}</p></Card>
      <p><Link to="/home/saved">{t('route.saved')}</Link> · <Link to="/home/sailings">{t('discover.allDates')}</Link></p>
    </div>
  )
}
