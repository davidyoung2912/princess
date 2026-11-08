import { Link, useSearchParams } from 'react-router'
import { t, th, type StringKey } from '../../i18n'
import { favouriteKey } from '../../domain/favourites'
import {
  BROWSE_SORTS, NIGHTS_BANDS, browseSailings, filterSailings, groupByMonth, legBadge, monthLabel, monthsOf, portOptions, portsOf, rangeOf, sortSailings,
  type BrowseFilter, type BrowseSort, type NightsBand,
} from '../../domain/catalogueBrowse'
import { portById } from '../../domain/sailings'
import { catalogueRegions, catalogueShips } from '../../domain/shipCatalogue'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { useCatalogue } from '../../hooks/useCatalogue'
import { useFavourites } from '../../hooks/useFavourites'
import { Card } from '../Card'
import { Button, LinkButton } from '../Button'
import { Bookmark, BookmarkCheck } from '../icons'
import { wantMatches } from '../../domain/rememberDelights'
import { useMemory } from '../../hooks/useMemory'
import { FromPriceBlock } from './parts'
import { PriceCalendar } from './PriceCalendar'
import { useNow } from '../../hooks/useDemo'
import { localDate } from '../../domain/tileLive'
import { CataloguePrice, DataStatusNote } from './catalogueParts'
import { regionName, shipName } from './catalogueNames'

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined => (allowed.includes(value as T) ? (value as T) : undefined)

/** Reads the filter and sort from the address, so a link from Explore (or a saved link) opens the same view. */
function readParams(p: URLSearchParams): { filter: BrowseFilter; sort: BrowseSort } {
  const filter: BrowseFilter = {}
  for (const k of ['ship', 'region', 'month', 'port'] as const) { const v = p.get(k); if (v) filter[k] = v }
  const nights = pick<NightsBand>(p.get('nights'), NIGHTS_BANDS)
  if (nights) filter.nights = nights
  if (p.get('bookable') === '1') filter.bookable = true
  return { filter, sort: pick<BrowseSort>(p.get('sort'), BROWSE_SORTS) ?? 'soonest' }
}

/** Browse the catalogue: every ship's sailings, filtered by ship, region, month, length and port, sorted, and grouped by month (H07). */
export function SailingsScreen() {
  useCatalogue()
  const [params, setParams] = useSearchParams()
  const { filter, sort } = readParams(params)
  const offers = useAsync(() => api.discover.offers(), [])
  const favourites = useFavourites()
  const { state } = useMemory()
  const all = browseSailings()
  const shown = sortSailings(filterSailings(all, filter), sort)
  const groups = sort === 'soonest' ? groupByMonth(shown) : [{ month: '', sailings: shown }]
  const ships = catalogueShips().filter((s) => all.some((x) => x.ship === s.id))
  const regions = catalogueRegions().filter((r) => all.some((x) => x.region === r.id))
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const filtered = Object.keys(filter).length > 0
  const now = useNow()
  const calendar = params.get('view') === 'calendar'
  const priceOf = (id: string) => offers.data?.find((o) => o.id === id)?.from.allIn ?? all.find((x) => x.id === id)?.fromCents ?? null
  const savedSailings = favourites.keys.filter((k) => k.startsWith('sailing:')).length
  const select = (id: string, label: string, key: string, options: { value: string; label: string }[], any: StringKey) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={params.get(key) ?? ''} onChange={(e) => set(key, e.target.value)}>
        <option value="">{t(any)}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
  return (
    <div className="page">
      <p>{t('cat.browseIntro')}</p>
      <form className="filters" aria-label={t('cat.filters')} onSubmit={(e) => e.preventDefault()}>
        {ships.length > 1 && select('f-ship', t('cat.ship'), 'ship', ships.map((s) => ({ value: s.id, label: s.name })), 'cat.anyShip')}
        {regions.length > 1 && select('f-region', t('cat.region'), 'region', regions.map((r) => ({ value: r.id, label: r.name })), 'cat.anyRegion')}
        {select('f-month', t('cat.month'), 'month', monthsOf(all).map((m) => ({ value: m, label: monthLabel(m) })), 'cat.anyMonth')}
        {select('f-nights', t('cat.length'), 'nights', NIGHTS_BANDS.map((b) => ({ value: b, label: t(`cat.nights.${b}` as StringKey) })), 'cat.anyLength')}
        {all.length > 0 && portOptions(all).length > 1 && select('f-port', t('cat.port'), 'port', portOptions(all).map((p) => ({ value: p.id, label: p.name })), 'cat.anyPort')}
        {select('f-sort', t('cat.sort'), 'sort', BROWSE_SORTS.filter((s) => s !== 'soonest').map((s) => ({ value: s, label: t(`cat.sort.${s}` as StringKey) })), 'cat.sort.soonest')}
        <label className="choice">
          <input type="checkbox" checked={!!filter.bookable} onChange={(e) => set('bookable', e.target.checked ? '1' : '')} />
          {t('cat.bookableOnly')}
        </label>
        <fieldset className="field">
          <legend>{t('pcal.view')}</legend>
          {(['list', 'calendar'] as const).map((v) => (
            <label key={v} className="choice"><input type="radio" name="view" checked={(v === 'calendar') === calendar} onChange={() => set('view', v === 'calendar' ? 'calendar' : '')} />{t(`pcal.view.${v}` as StringKey)}</label>
          ))}
        </fieldset>
        {filtered && <Button variant="tertiary" onClick={() => setParams({ ...(sort === 'soonest' ? {} : { sort }), ...(calendar ? { view: 'calendar' } : {}) }, { replace: true })}>{t('cat.clear')}</Button>}
      </form>
      <p role="status" className="muted">{t('cat.count', { count: shown.length })}</p>
      {savedSailings >= 2 && <p><Link to="/home/saved/compare">{t('cat.compareSaved')}</Link></p>}
      {shown.length === 0 && <Card info><p>{t('cat.noMatch')}</p></Card>}
      {calendar && shown.length > 0 && <PriceCalendar sailings={shown} priceOf={priceOf} today={localDate(now)} />}
      {!calendar && groups.map((g) => (
        <section key={g.month || 'all'} aria-labelledby={g.month ? `m-${g.month}` : undefined}>
          {g.month && <h2 id={`m-${g.month}`}>{monthLabel(g.month)}</h2>}
          <ul className="card-grid">
            {g.sailings.map((s) => {
              const offer = offers.data?.find((o) => o.id === s.id)
              const key = favouriteKey('sailing', s.id)
              const saved = favourites.has(key)
              const Icon = saved ? BookmarkCheck : Bookmark
              const badge = legBadge(s, all)
              const hits = state.remember.wants.length > 0 ? wantMatches(state.remember.wants, portsOf(s).map((p) => portById(p)?.name ?? p)) : null
              return (
                <li key={s.id}>
                  <Card>
                    <h3 className="card__title"><Link to={`/home/sailings/${s.id}`}>{s.title}<span className="visually-hidden">, {rangeOf(s)}</span></Link></h3>
                    <p>{rangeOf(s)} · {t('cat.nightsCount', { count: s.nights })}</p>
                    <p className="muted">{shipName(s.ship)}{s.region ? ` · ${regionName(s.region)}` : ''}</p>
                    <p>
                      {s.holiday && <span className="tag">{t('discover.holiday')}</span>}
                      {badge?.kind === 'joined' && <span className="tag">{t('cat.legs', { count: badge.legs })}</span>}
                      {badge?.kind === 'addNext' && <Link className="tag" to={`/home/sailings/${badge.nextId}`}>{t('cat.addNext', { nights: badge.nights })}</Link>}
                      {!s.bookingOpen && <span className="tag">{t('cat.browseOnly')}</span>}
                    </p>
                    {hits && (hits.length > 0
                      ? <p className="tag tag--good">{t('dl9.want.on', { places: [...new Set(hits.map((h) => h.place))].join('; ') })}</p>
                      : <p className="muted">{t('dl9.want.off')}</p>)}
                    {offer ? <FromPriceBlock price={offer.from} /> : <CataloguePrice sailing={s} />}
                    {s.dataStatus === 'sample' && <DataStatusNote sailing={s} />}
                    {s.bookingOpen && <LinkButton to={`/book?sailing=${s.id}`} variant="secondary">{t('discover.bookDate')}<span className="visually-hidden"> {rangeOf(s)}</span></LinkButton>}
                    <Button variant="tertiary" aria-pressed={saved} disabled={!favourites.ready} onClick={() => void favourites.toggle(key)}>
                      <Icon aria-hidden="true" />
                      <span>{t('discover.save')}<span className="visually-hidden"> {s.title}, {rangeOf(s)}</span></span>
                    </Button>
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="muted" role="status">{favourites.failed ? t('discover.saveFailed') : ''}</p>
      <p><Link to="/home/explore">{th('cat.exploreLink')}</Link> · <Link to="/home/ships">{th('cat.shipsLink')}</Link></p>
    </div>
  )
}
