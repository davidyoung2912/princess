import { Link, useSearchParams } from 'react-router'
import { t, type StringKey } from '../../i18n'
import { browseSailings, shipCompareRows, shipSailingSummary } from '../../domain/catalogueBrowse'
import { catalogueShips, shipById, type ShipSummary } from '../../domain/shipCatalogue'
import { useShip } from '../../hooks/useShipCatalogue'
import { useCatalogue } from '../../hooks/useCatalogue'
import { Card } from '../Card'
import { LinkButton } from '../Button'

const number = new Intl.NumberFormat('en-US')

function show(key: string, v: string | number | undefined): string {
  if (v === undefined) return t('cat.compare.unknown')
  if (key === 'depth') return t(v === 'aboard' ? 'cat.depth.aboard' : 'cat.depth.browse')
  if (key === 'lengthFt') return `${number.format(Number(v))} ft`
  return typeof v === 'number' ? (key === 'entered' ? String(v) : number.format(v)) : v
}

/** Two or three ships side by side as a facts table (H48). The ships are chosen in the address (`a`, `b`, `c`) and by the pickers on the page. */
export function CompareShipsScreen() {
  useCatalogue()
  const current = useShip()
  const [params, setParams] = useSearchParams()
  const ships = catalogueShips().length > 0 ? catalogueShips() : current.id ? [current] : []
  const chosen = ['a', 'b', 'c'].map((k) => params.get(k) ?? '')
  // Two ships are always shown: the ones named, then the first not yet shown.
  const picked: ShipSummary[] = []
  for (const id of chosen) { const s = shipById(id); if (s && !picked.includes(s)) picked.push(s) }
  for (const s of ships) { if (picked.length < 2 && !picked.includes(s)) picked.push(s) }
  const rows = shipCompareRows(picked)
  const sailings = browseSailings()
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    const ids = picked.map((s) => s.id)
    const slots = ['a', 'b', 'c']
    const at = slots.indexOf(key)
    if (value) ids[at] = value
    else ids.splice(at, 1)
    slots.forEach((k) => next.delete(k))
    ids.forEach((id, i) => { if (id) next.set(slots[i], id) })
    setParams(next, { replace: true })
  }
  return (
    <div className="page">
      <p>{t('cat.compare.intro')}</p>
      {ships.length < 2 ? <Card info><p>{t('cat.compare.needTwo')}</p></Card> : (
        <>
          <div className="filters">
            {[0, 1, 2].map((i) => (
              <div className="field" key={i}>
                <label htmlFor={`ship-${i}`}>{t('cat.compare.shipN', { n: i + 1 })}</label>
                <select id={`ship-${i}`} value={picked[i]?.id ?? ''} onChange={(e) => set(['a', 'b', 'c'][i], e.target.value)}>
                  {i === 2 && <option value="">{t('cat.compare.none')}</option>}
                  {ships.map((s) => <option key={s.id} value={s.id} disabled={picked.some((p, j) => j !== i && p.id === s.id)}>{s.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="table-scroll">
            <table className="compare-table">
              <caption>{t('cat.compare.caption', { ships: picked.map((s) => s.name).join(', ') })}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="visually-hidden">{t('cat.compare.fact')}</span></th>
                  {picked.map((s) => <th key={s.id} scope="col"><Link to={`/home/ships/${s.id}`}>{s.name}</Link></th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{t(`cat.fact.${r.key}` as StringKey)}{r.differs && <span className="visually-hidden"> ({t('cat.compare.differs')})</span>}</th>
                    {r.values.map((v, i) => <td key={picked[i].id}>{show(r.key, v)}</td>)}
                  </tr>
                ))}
                <tr>
                  <th scope="row">{t('cat.compare.sailings')}</th>
                  {picked.map((s) => <td key={s.id}>{shipSailingSummary(s.id, sailings).count}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <Card info><p>{t('cat.compare.note')}</p></Card>
          <div className="button-row">
            {picked.map((s) => <LinkButton key={s.id} to={`/home/sailings?ship=${s.id}`} variant="secondary">{t('cat.ship.seeSailings', { ship: s.name })}</LinkButton>)}
          </div>
        </>
      )}
    </div>
  )
}
