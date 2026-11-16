import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ExplorerDay, VenueDay } from '../../api/explorerTypes'
import { cancelledListed, filterVenues, kindsOf, SEARCH_FROM } from '../../domain/explorer/presentation'
import { upcomingEvents } from '../../domain/explorer/upcoming'
import type { ExplorerKind } from '../../domain/explorer/types'
import { useExplorerData, useExplorerDay, type ExplorerDayState } from '../../hooks/useExplorer'
import { t } from '../../i18n'
import { Card } from '../Card'
import { Saved } from '../onboard/common'
import { ChosenDayNote, PickDateButton } from './DateControls'
import { EventRow, FilterChips, HappeningNow, HoursBadge } from './Parts'
import { MEAL } from './mealStrings'
import { useVenuePins, type VenuePins } from '../../hooks/useVenuePins'
import { PinButton } from './Pins'
import { DiningControls } from './DiningDiscovery'
import { dishHits, filterDining, hasKidsMenu, NO_DINING_FILTER, sortDining, type DiningFilter, type DiningSort } from '../../domain/explorer/diningDiscovery'
import { StanleyPose } from '../StanleyPose'
import { EXPLORER_POSE } from './venueArt'
import { ShipClockCard } from './ShipClockCard'
import { WhatChanged } from './WhatChanged'

export interface ExplorerContext { data: ExplorerDay; state: ExplorerDayState; reload: () => void }

interface ExplorerPageProps {
  kind: ExplorerKind
  /** The heading of the page's first card and its one-line purpose. */
  title: string
  purpose: string
  /** Where a venue's page is: `${basePath}/${venueId}`. */
  basePath: string
  /** The words for each kind of venue, for the filter chips. */
  kindLabels: Record<string, string>
  /** What goes between the date controls and the venue list: the guest's reservations, for the Explorers that take them. */
  above?: (c: ExplorerContext) => ReactNode
}

/** The page every Explorer shares: header card, ship clock, date controls, anything the Explorer puts above the list, filters, and the venue cards with pinned venues first. */
export function ExplorerPage({ kind, title, purpose, basePath, kindLabels, above }: ExplorerPageProps) {
  const state = useExplorerDay()
  const copy = useExplorerData(kind, state.day)
  return (
    <div className="page">
      <Card hero labelledBy="exp-head-h">
        <span className="landing-pose calm-hide"><StanleyPose pose={EXPLORER_POSE[kind]} size={88} /></span>
        <h2 id="exp-head-h" className="card__title">{title}</h2>
        <p>{purpose}</p>
      </Card>
      <ShipClockCard state={state} />
      <PickDateButton state={state} />
      <ChosenDayNote state={state} />
      <Saved copy={copy}>
        {(data) => (
          <>
            <HappeningNow data={data} currentDay={state.currentDay} now={state.nowAt} basePath={basePath} />
            <WhatChanged data={data} now={state.nowAt} basePath={basePath} />
            {above?.({ data, state, reload: copy.retry })}
            <VenueList data={data} state={state} basePath={basePath} kindLabels={kindLabels} />
          </>
        )}
      </Saved>
    </div>
  )
}

function VenueList({ data, state, basePath, kindLabels }: { data: ExplorerDay; state: ExplorerDayState; basePath: string; kindLabels: Record<string, string> }) {
  const [kind, setKind] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const pins = useVenuePins(data.venues.map((v) => v.venue))
  const dining = data.explorer === 'dining'
  const [filter, setFilter] = useState<DiningFilter>(NO_DINING_FILTER)
  const [sort, setSort] = useState<DiningSort>('suggested')
  const flat = data.venues.map((v) => ({ ...v, ...v.venue }))
  const shown = dining
    ? sortDining(filterDining(pins.order(flat), filter), sort, { chosenDay: state.day, currentDay: state.currentDay, now: state.now })
    : pins.order(filterVenues(flat, { kind, query }))
  return (
    <section aria-labelledby="exp-list-h">
      <h2 id="exp-list-h">{t('exp.list.title')}</h2>
      {dining && <DiningControls kinds={kindsOf(data.venues.map((v) => v.venue))} kindLabels={kindLabels} filter={filter} onFilter={setFilter} sort={sort} onSort={setSort} anyKidsMenu={data.venues.some((v) => hasKidsMenu(v.venue))} />}
      {!dining && <FilterChips kinds={kindsOf(data.venues.map((v) => v.venue))} label={t('exp.filter.label')} value={kind} onChange={setKind} labels={kindLabels} />}
      {!dining && data.venues.length > SEARCH_FROM && (
        <div className="field">
          <label htmlFor="exp-search">{t('exp.search.label')}</label>
          <input id="exp-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      <p role="status" className="visually-hidden">{pins.message}</p>
      {pins.message && <p className="muted" aria-hidden="true">{pins.message}</p>}
      {shown.length === 0 ? <p className="muted">{t('exp.list.none')}</p> : (
        <ul className="card-grid">
          {shown.map((v) => <VenueCard key={v.venue.id} day={v} state={state} basePath={basePath} pins={pins} kindLabels={kindLabels} dishQuery={dining ? filter.query : ''} />)}
        </ul>
      )}
    </section>
  )
}

/** One venue: its pin, its words, whether it is open on the chosen day and the next events there. The whole card links to the venue's page; the pin is a button of its own. */
function VenueCard({ day, state, basePath, pins, kindLabels, dishQuery }: { day: VenueDay; state: ExplorerDayState; basePath: string; pins: VenuePins; kindLabels: Record<string, string>; dishQuery: string }) {
  const dishes = dishHits(day.menus, dishQuery).slice(0, 3)
  const v = day.venue
  const upcoming = upcomingEvents(day.events, { chosenDay: state.day, currentDay: state.currentDay, now: state.nowAt })
  const cancelled = cancelledListed(day.events, { chosenDay: state.day, currentDay: state.currentDay, now: state.nowAt })
  return (
    <li className="card exp-card">
      <PinButton venue={v} pins={pins} />
      <h3 className="card__title"><Link className="exp-card__link" to={`${basePath}/${v.id}?day=${state.day}`}>{v.title}</Link></h3>
      <p className="muted">{kindLabels[v.kind] ?? v.kind} · {v.deckLabel}</p>
      <HoursBadge hours={day.hours} day={state.day} currentDay={state.currentDay} now={state.now} />
      <p>{v.short}</p>
      {dishes.length > 0 && <p>{t('exp.dining.serves', { list: dishes.map((d) => `${d.name} (${t(MEAL[d.meal])})`).join(', ') })}</p>}
      {upcoming.length + cancelled.length > 0 && (
        <ul className="exp-events">
          {[...upcoming, ...cancelled].sort((a, b) => a.startAt - b.startAt).map((e) => <EventRow key={e.id} event={e} now={state.nowAt} compact />)}
        </ul>
      )}
    </li>
  )
}
