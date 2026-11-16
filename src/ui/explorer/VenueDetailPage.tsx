import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { ExplorerDay, VenueDay } from '../../api/explorerTypes'
import type { DietaryId } from '../../domain/account'
import { formatMoney } from '../../domain/money'
import { clashesWith, type Span } from '../../domain/explorer/presentation'
import type { ExplorerKind } from '../../domain/explorer/types'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { useExplorerData, useExplorerDay, usePlan, useVenueData, type ExplorerDayState } from '../../hooks/useExplorer'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { BackLink, Saved } from '../onboard/common'
import { ChosenDayNote, PickDateButton } from './DateControls'
import { EventRow, FilterChips, HoursBadge, MenuPanel } from './Parts'
import { staffedText, windowsText } from './text'
import { useVenuePins } from '../../hooks/useVenuePins'
import { PinButton } from './Pins'
import { ShipClockCard } from './ShipClockCard'

export interface VenueContext { venue: VenueDay; explorerDay: ExplorerDay | null; state: ExplorerDayState; reload: () => void }

interface VenueDetailProps {
  kind: ExplorerKind
  basePath: string
  backLabel: string
  /** What goes under the date controls: the guest's reservations at this venue, for the Explorers that take them. */
  above?: (c: VenueContext) => ReactNode
  /** Spans of time the guest already has taken (reservations), so an event that overlaps one is flagged. */
  busy?: (c: VenueContext) => readonly Span[]
}

/** The diets of the signed-in guest, so the menus can show first what suits them. */
function useMyDiets(): DietaryId[] {
  const me = usePersona()
  const profile = useMine(() => api.account.profile(me!.id), [me?.id])
  return profile.data?.profile.dietary ?? []
}

/** The page every Explorer's venue shares: where it is, the day's hours, the guest's reservations, the menu, and every event of the day with a plan toggle. */
export function VenueDetailPage({ kind, basePath, backLabel, above, busy }: VenueDetailProps) {
  const { venueId = '' } = useParams()
  const state = useExplorerDay()
  const venueCopy = useVenueData(kind, venueId, state.day)
  const dayCopy = useExplorerData(kind, state.day)
  const diets = useMyDiets()
  const siblings = dayCopy.data?.venues ?? []
  return (
    <div className="page exp-split">
      {siblings.length > 1 && (
        <nav className="exp-split__list" aria-labelledby="exp-others-h">
          <h2 id="exp-others-h">{t('exp.venue.others')}</h2>
          <ul>
            {siblings.map((s) => (
              <li key={s.venue.id}>
                <Link to={`${basePath}/${s.venue.id}?day=${state.day}`} aria-current={s.venue.id === venueId ? 'page' : undefined}>{s.venue.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="exp-split__detail">
      <ShipClockCard state={state} />
      <PickDateButton state={state} />
      <ChosenDayNote state={state} />
      {venueCopy.status === 'error' && venueCopy.data === null ? (
        <Banner kind="info" title={t('exp.venue.gone')} action={<LinkButton to={basePath} variant="secondary">{backLabel}</LinkButton>}><p>{t('exp.venue.goneBody')}</p></Banner>
      ) : (
        <Saved copy={venueCopy}>
          {(venue) => <Body venue={venue} explorerDay={dayCopy.data} state={state} diets={diets} above={above} busy={busy} reload={() => { venueCopy.retry(); dayCopy.retry() }} />}
        </Saved>
      )}
      <BackLink to={`${basePath}?day=${state.day}`} label={backLabel} />
      </div>
    </div>
  )
}

function Body({ venue, explorerDay, state, diets, above, busy, reload }: { venue: VenueDay; explorerDay: ExplorerDay | null; state: ExplorerDayState; diets: DietaryId[]; above?: VenueDetailProps['above']; busy?: VenueDetailProps['busy']; reload: () => void }) {
  const v = venue.venue
  const pins = useVenuePins([v])
  const plan = usePlan(state.day, explorerDay?.mine ?? [], { added: (title) => t('exp.plan.added', { title }), removed: (title) => t('exp.plan.removed', { title }) })
  const [interest, setInterest] = useState<string | null>(null)
  const interests = [...new Set(venue.events.map((e) => e.interest))]
  const shownEvents = interest === null ? venue.events : venue.events.filter((e) => e.interest === interest)
  const ctx: VenueContext = { venue, explorerDay, state, reload }
  const past = state.day < state.currentDay
  const taken = busy?.(ctx) ?? []
  const planned: Span[] = venue.events.filter((e) => plan.planned.has(e.id)).map((e) => ({ id: e.id, title: e.title, startAt: e.startAt, endAt: e.endAt }))
  return (
    <>
      <Card hero labelledBy="exp-venue-h">
        <PinButton venue={v} pins={pins} />
        <h2 id="exp-venue-h" className="card__title">{v.title}</h2>
        <p className="muted">{v.deckLabel}</p>
        <p role="status" className="visually-hidden">{pins.message}</p>
      </Card>
      {above?.(ctx)}
      <section aria-labelledby="exp-sum-h">
        <h2 id="exp-sum-h">{t('exp.venue.about')}</h2>
        <p>{v.short}</p>
        {v.long !== v.short && <p>{v.long}</p>}
        <p><HoursBadge hours={venue.hours} day={state.day} currentDay={state.currentDay} now={state.now} /></p>
        {venue.hours.windows.length > 0 && <p>{t('exp.venue.hours', { hours: windowsText(venue.hours) })}</p>}
        {staffedText(venue.hours) && <p>{t('exp.venue.staffed', { hours: staffedText(venue.hours) })}</p>}
        <ul className="tour__facts">
          {v.cover !== undefined && <li>{t('exp.venue.cover', { amount: formatMoney(v.cover) })}</li>}
          {v.minAge !== undefined && <li>{t('exp.venue.minAge', { age: v.minAge })}</li>}
          {v.features.map((f) => <li key={f}>{f}</li>)}
          {v.accessibility.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </section>
      <MenuPanel menus={venue.menus} diets={diets} />
      <section aria-labelledby="exp-ev-h">
        <h2 id="exp-ev-h">{t('exp.venue.events')}</h2>
        <p role="status" className="visually-hidden">{plan.announcement}</p>
        {plan.failed && <p role="alert" className="field__error">{t('exp.plan.failed')}</p>}
        {past && venue.events.length > 0 && <p className="muted">{t('exp.venue.readOnly')}</p>}
        <FilterChips kinds={interests} label={t('exp.interest.label')} value={interest} onChange={setInterest} labels={Object.fromEntries(interests.map((i) => [i, t(`exp.interest.${i}` as StringKey)]))} />
        {venue.events.length === 0 ? <p className="muted">{t('exp.venue.noEvents')}</p> : (
          <ul className="exp-events">
            {shownEvents.map((e) => (
              <EventRow key={e.id} event={e} now={state.nowAt}
                clash={clashesWith(e, [...taken, ...planned])}
                plan={past || !explorerDay ? undefined : { planned: plan.planned.has(e.id), busy: plan.busy, onToggle: () => { void plan.toggle(e.id, e.title, !plan.planned.has(e.id)) } }} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
