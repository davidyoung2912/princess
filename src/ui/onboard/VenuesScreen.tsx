import { useState } from 'react'
import { Link, useParams } from 'react-router'
import type { DietaryId } from '../../domain/account'
import { formatTime } from '../../domain/cruise'
import { coverOf, DIRECTORY, directoryVenue, dishesFor, dishSuits, hoursText, NEEDS_ASKING, openAt, reservableVenue, venueState, type DirectoryVenue } from '../../domain/menus'
import { DRESS_NOTES } from '../../domain/dining'
import { formatMoney } from '../../domain/money'
import { api } from '../../runtime'
import { usePersona } from '../../hooks/useDemo'
import { useShipDay } from '../../hooks/useShipDay'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { QueueControl } from './Waits'
import { BackLink } from './common'
import { FavouriteButton, FavouritesTonight, SayThanks } from '../delights/SeaDelights'

/** The diets of everyone on the signed-in booking who has told us about one, so the menus can hide what does not suit. */
function usePartyDiets(): { diets: DietaryId[]; ready: boolean } {
  const me = usePersona()
  const profile = useMine(() => api.account.profile(me!.id), [me?.id])
  return { diets: profile.data?.profile.dietary ?? [], ready: profile.status === 'ready' }
}

/** Every place to eat and drink, with hours for today, price and dress code (DIN-01). */
export function VenuesScreen() {
  const [openNow, setOpenNow] = useState(false)
  const [included, setIncluded] = useState(false)
  const { day, time } = useShipDay()
  const list = DIRECTORY.filter((v) => (!openNow || openAt(v, day, time)) && (!included || v.price !== 'specialty'))
  return (
    <div className="page">
      <p>{t('ven.intro')}</p>
      <div className="chip-row">
        <Chip pressed={openNow} onToggle={() => setOpenNow(!openNow)}>{t('ven.openNow')}</Chip>
        <Chip pressed={included} onToggle={() => setIncluded(!included)}>{t('ven.included')}</Chip>
      </div>
      <FavouritesTonight />
      <p role="status" className="muted">{t('ven.count', { count: list.length })}</p>
      <ul className="card-grid">
        {list.map((v) => (
          <li key={v.id} className="card">
            <h2 className="card__title"><Link to={`/ship/venues/${v.id}`}>{v.name}</Link></h2>
            <p>{v.blurb}</p>
            <p className="muted">{v.deck} · <PriceText v={v} /> · <StateText v={v} day={day} time={time} /></p>
          </li>
        ))}
      </ul>
      <SayThanks />
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

/** Open, closed or temporarily unavailable, with the ship time it was worked out for. */
function StateText({ v, day, time }: { v: DirectoryVenue; day: 'sea' | 'port'; time: string }) {
  const state = venueState(v, day, time)
  return <>{t(`ven.state.${state}` as StringKey)} ({t('ven.asOf', { time: formatTime(time) })})</>
}

function PriceText({ v }: { v: DirectoryVenue }) {
  const cover = coverOf(v)
  return <>{v.price === 'included' ? t('ven.price.included') : v.price === 'casual' ? t('ven.price.casual') : cover ? t('ven.price.specialty', { amount: formatMoney(cover) }) : t('ven.price.specialtyOnly')}</>
}

/** One venue: hours on sea and port days, dress, price, and the menu with what each dish contains (DIN-01, DIN-03). */
export function VenueScreen() {
  const { id } = useParams()
  const v = directoryVenue(id)
  const { diets } = usePartyDiets()
  const { day, time } = useShipDay()
  const [filtered, setFiltered] = useState(true)
  return (
    <div className="page">
      {!v ? (
        <Banner kind="info" title={t('ven.gone')} action={<LinkButton to="/ship/venues" variant="secondary">{t('route.venues')}</LinkButton>}><p>{t('ven.goneBody')}</p></Banner>
      ) : (
        <>
          <Card hero labelledBy="ven-h">
            <h2 id="ven-h" className="card__title">{v.name}</h2>
            <p>{v.blurb}</p>
            <ul className="tour__facts">
              <li>{v.deck}</li>
              <li><PriceText v={v} /></li>
              <li>{DRESS_NOTES[v.dress]}</li>
              <li><StateText v={v} day={day} time={time} /></li>
            </ul>
            {reservableVenue(v) && <p><LinkButton to="/plan/dining" variant="secondary">{t('ven.reserve')}</LinkButton></p>}
          </Card>
          {!reservableVenue(v) && v.id !== 'soleil' && <QueueControl venueId={v.id} />}
          <section aria-labelledby="hours-h">
            <h2 id="hours-h">{th('ven.hours')}</h2>
            <dl className="plain-dl">
              {(['sea', 'port'] as const).map((d) => <div key={d}><dt>{t(`ven.hours.${d}` as StringKey)}</dt><dd>{hoursText(v.hours[d], formatTime) || t('ven.allDay')}</dd></div>)}
            </dl>
          </section>
          <Menu v={v} diets={diets} filtered={filtered} setFiltered={setFiltered} />
          <SayThanks team={v.name} />
        </>
      )}
      <BackLink to="/ship/venues" label={t('route.venues')} />
    </div>
  )
}

function Menu({ v, diets, filtered, setFiltered }: { v: DirectoryVenue; diets: DietaryId[]; filtered: boolean; setFiltered: (b: boolean) => void }) {
  const shown = filtered ? dishesFor(v, diets) : v.dishes
  const asks = diets.filter((d) => NEEDS_ASKING.includes(d))
  return (
    <section aria-labelledby="menu-h">
      <h2 id="menu-h">{th('ven.menu')}</h2>
      {diets.length > 0 && (
        <>
          <p>{t('ven.diets', { list: diets.map((d) => t(`profile.dietary.${d}` as StringKey)).join(', ') })}</p>
          <div className="chip-row"><Chip pressed={filtered} onToggle={() => setFiltered(!filtered)}>{t('ven.hideUnsuitable')}</Chip></div>
        </>
      )}
      {asks.length > 0 && <Banner kind="info" title={t('ven.ask')}><p>{t('ven.askBody')}</p></Banner>}
      {shown.length === 0 ? <p>{t('ven.nothing')}</p> : (
        <ul className="dish-list">
          {shown.map((d) => (
            <li key={d.name}>
              <strong>{d.name}</strong>
              <br />
              <span className="muted">{d.contains.length === 0 ? t('ven.containsNone') : t('ven.contains', { list: d.contains.map((c) => t(`ven.c.${c}` as StringKey)).join(', ') })}</span>
              {diets.some((x) => !dishSuits(d, x)) && <span className="tag">{t('ven.notForYou')}</span>}
              <FavouriteButton venueId={v.id} dish={d.name} />
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{t('ven.allergyNote')}</p>
    </section>
  )
}
