import { useState, type ReactNode } from 'react'
import { useMirrorParams } from '../../../shared/hooks/useUrlState'
import { useSearchParams } from 'react-router'
import { readUrlFilter } from '../domain/urlFilter'
import { Link } from 'react-router'
import type { DietMark, ExplorerDay, VenueDay } from '../../../shared/api/explorerTypes'
import { cancelledListed, filterVenues, kindsOf, SEARCH_FROM } from '../domain/presentation'
import { upcomingEvents } from '../domain/upcoming'
import type { ExplorerKind } from '../domain/types'
import { useExplorerData, useExplorerDay, type ExplorerDayState } from '../../../shared/hooks/useExplorer'
import { t, headingCase, type StringKey } from '../../../shared/i18n'
import { Saved } from '../../onboard/ui/common'
import { PickDateButton } from './DateControls'
import { EventRow, FilterChips, HappeningNow, HoursBadge } from './Parts'
import { MEAL } from './mealStrings'
import { useVenuePins, type VenuePins } from '../../../shared/hooks/useVenuePins'
import { PinButton } from './Pins'
import { DiningControls } from './DiningDiscovery'
import { dishHits, filterDining, hasKidsMenu, markedDishes, NO_DINING_FILTER, sortDining, type DiningFilter, type DiningSort } from '../domain/diningDiscovery'
import { ShipClockCard } from './ShipClockCard'
import { DaySummaryCard } from './DaySummaryCard'
import { WhatChanged } from './WhatChanged'
import { ForYou } from './ForYou'
import { forYouFirst, recommendEvents, recommendVenues } from '../domain/recommend'
import { useTaste } from '../../../shared/hooks/useTaste'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { SendToChat } from '../../onboard/ui/SendToChat'

export interface ExplorerContext { data: ExplorerDay; state: ExplorerDayState; reload: () => void }

interface ExplorerPageProps {
  kind: ExplorerKind
  /** Where a venue's page is: `${basePath}/${venueId}`. */
  basePath: string
  /** The words for each kind of venue, for the filter chips. */
  kindLabels: Record<string, string>
  /** What goes between the date controls and the venue list: the guest's reservations, for the Explorers that take them. */
  above?: (c: ExplorerContext) => ReactNode
}

/** The page every Explorer shares: header card, ship clock, date controls, anything the Explorer puts above the list, filters, and the venue cards with pinned venues first. */
export function ExplorerPage({ kind, basePath, kindLabels, above }: ExplorerPageProps) {
  const state = useExplorerDay()
  const copy = useExplorerData(kind, state.day)
  return (
    <div className="page">
      <ShipClockCard state={state} />
      <PickDateButton state={state} />
      <Saved copy={copy}>
        {(data) => (
          <>
            <DaySummaryCard kind={kind} data={data} state={state} />
            <HappeningNow data={data} currentDay={state.currentDay} now={state.nowAt} basePath={basePath} />
            <WhatChanged data={data} now={state.nowAt} basePath={basePath} />
            {above?.({ data, state, reload: copy.retry })}
            <VenueList data={data} state={state} basePath={basePath} kindLabels={kindLabels} onChanged={copy.retry} />
          </>
        )}
      </Saved>
    </div>
  )
}

function VenueList({ data, state, basePath, kindLabels, onChanged }: { data: ExplorerDay; state: ExplorerDayState; basePath: string; kindLabels: Record<string, string>; onChanged: () => void }) {
  // An address may arrive with `?q=` and `?type=` (a suggestion from Stanley); they only start the filters, which the guest can change or clear.
  const [params] = useSearchParams()
  const [start] = useState(() => readUrlFilter(params))
  const kinds = kindsOf(data.venues.map((v) => v.venue))
  const startKind = start.type !== null && kinds.includes(start.type) ? start.type : null
  const [kind, setKind] = useState<string | null>(startKind)
  const [query, setQuery] = useState(start.q)
  const pins = useVenuePins(data.venues.map((v) => v.venue))
  const dining = data.explorer === 'dining'
  const [filter, setFilter] = useState<DiningFilter>({ ...NO_DINING_FILTER, kind: startKind, diet: start.diet, query: start.q })
  const [sort, setSort] = useState<DiningSort>('suggested')
  useMirrorParams({ q: dining ? filter.query : query, type: dining ? filter.kind : kind, diet: dining ? filter.diet : null })
  const { profile: taste } = useTaste()
  const pinnedIds = data.venues.filter((v) => pins.isPinned(v.venue)).map((v) => v.venue.id)
  const picks = dining ? { events: [], venues: recommendVenues(data, taste, { pinnedVenueIds: pinnedIds }) } : { events: recommendEvents(data, taste, { now: state.nowAt, pinnedVenueIds: pinnedIds }), venues: [] }
  const pickedVenues = dining ? picks.venues.map((p) => p.venueId) : [...new Set(picks.events.map((p) => p.venueId))]
  const flat = data.venues.map((v) => ({ ...v, ...v.venue }))
  const ordered = forYouFirst(pins.order(flat), pickedVenues, (v) => pins.isPinned(v.venue))
  const shown = dining
    ? sortDining(filterDining(ordered, filter), sort, { chosenDay: state.day, currentDay: state.currentDay, now: state.now })
    : filterVenues(ordered, { kind, query })
  return (
    <>
    <ForYou data={data} events={picks.events} venues={picks.venues} venueTitles={Object.fromEntries(data.venues.map((v) => [v.venue.id, v.venue.title]))} basePath={basePath} onChanged={onChanged} />
    <section aria-labelledby="exp-list-h" data-tour="exp-list">
      <h2 id="exp-list-h">{headingCase(t('exp.list.title'))}</h2>
      {dining && <DiningControls kinds={kindsOf(data.venues.map((v) => v.venue))} kindLabels={kindLabels} filter={filter} onFilter={setFilter} sort={sort} onSort={setSort} anyKidsMenu={data.venues.some((v) => hasKidsMenu(v.venue))} />}
      {!dining && <FilterChips kinds={kindsOf(data.venues.map((v) => v.venue))} label={t('exp.filter.label')} value={kind} onChange={setKind} labels={kindLabels} />}
      {!dining && (data.venues.length > SEARCH_FROM || start.q !== '') && (
        <div className="field">
          <label htmlFor="exp-search">{t('exp.search.label')}</label>
          <input id="exp-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      <p role="status" className="visually-hidden">{pins.message}</p>
      {pins.message && <p className="muted" aria-hidden="true">{pins.message}</p>}
      {shown.length === 0 ? <p className="muted">{t('exp.list.none')}</p> : (
        <ul className="card-grid">
          {shown.map((v, i) => <VenueCard key={v.venue.id} first={i === 0} day={v} state={state} basePath={basePath} pins={pins} kindLabels={kindLabels} dishQuery={dining ? filter.query : ''} diet={dining ? filter.diet : null} forYou={pickedVenues.includes(v.venue.id)} />)}
        </ul>
      )}
    </section>
    </>
  )
}

/** One venue: its pin, its words, whether it is open on the chosen day and the next events there. The whole card links to the venue's page; the pin is a button of its own. */
function VenueCard({ day, state, basePath, pins, kindLabels, dishQuery, diet, forYou, first }: { first: boolean; day: VenueDay; state: ExplorerDayState; basePath: string; pins: VenuePins; kindLabels: Record<string, string>; dishQuery: string; diet: DietMark | null; forYou: boolean }) {
  const dishes = dishHits(day.menus, dishQuery).slice(0, 3)
  const marked = diet ? markedDishes(day.menus, diet).slice(0, 3) : []
  const v = day.venue
  const upcoming = upcomingEvents(day.events, { chosenDay: state.day, currentDay: state.currentDay, now: state.nowAt })
  const cancelled = cancelledListed(day.events, { chosenDay: state.day, currentDay: state.currentDay, now: state.nowAt })
  return (
    <li className="card exp-card">
      <PinButton venue={v} pins={pins} tour={first ? 'exp-pin' : undefined} />
      <h3 className="card__title"><Link className="exp-card__link" to={`${basePath}/${v.id}?day=${state.day}`}>{v.title}</Link> <SendToChat shareRef={`venue:${v.id}`} title={v.title} /></h3>
      <p className="muted">{kindLabels[v.kind] ?? v.kind} · {v.deckLabel}</p>
      {forYou && !pins.isPinned(v) && <StatusBadge kind="ready" label={t('exp.foryou.badge')} />}
      <HoursBadge hours={day.hours} day={state.day} currentDay={state.currentDay} now={state.now} />
      <p>{v.short}</p>
      {dishes.length > 0 && <p>{t('exp.dining.serves', { list: dishes.map((d) => `${d.name} (${t(MEAL[d.meal])})`).join(', ') })}</p>}
      {marked.length > 0 && <p>{t('exp.dining.marked', { diet: t(`exp.dining.diet.${diet!}` as StringKey), list: marked.map((d) => `${d.name} (${t(MEAL[d.meal])})`).join(', ') })}</p>}
      {upcoming.length + cancelled.length > 0 && (
        <ul className="exp-events">
          {[...upcoming, ...cancelled].sort((a, b) => a.startAt - b.startAt).map((e) => <EventRow key={e.id} event={e} now={state.nowAt} compact />)}
        </ul>
      )}
    </li>
  )
}
