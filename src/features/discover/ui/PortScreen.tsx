import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PillIcon } from '../../../shared/ui/PillIcon'
import { t, th, type StringKey } from '../../../shared/i18n'
import { byTier, directionsUrl, mapUrl, type GuideAttraction, type GuideLink, type GuideStats } from '../../../domain/portGuide'
import { PORTS, itinerary, portById } from '../../../domain/sailings'
import { useFavourites } from '../../../shared/hooks/useFavourites'
import { useSailing } from '../../../shared/hooks/useDemo'
import { usePortGuide } from '../../../shared/hooks/useServedFeeds'
import { Banner } from '../../../shared/ui/Banner'
import { Card } from '../../../shared/ui/Card'
import { FeedWaiting } from '../../../shared/ui/FeedWaiting'
import { LinkButton } from '../../../shared/ui/Button'
import { Anchor } from '../../../shared/ui/icons'
import { Flag } from '../../../shared/ui/Flag'
import { SaveShare } from './parts'
import { StanleyExplain } from '../../stanley/ui/StanleyExplain'
import { TenderOutlook } from './TenderOutlook'
import { SendToChat } from '../../onboard/ui/SendToChat'
import { PlaceMap, type MapPin } from '../../maps/ui/PlaceMap'
import { PortDayPlanner } from '../../maps/ui/PortDayPlanner'
import { isLatLng } from '../../maps/logic/geo'

/**
 * Port Details: everything the guide holds for one port (the server's port guide): what it is like, how to get ashore, the things to do by how easy they
 * are to reach, traveller tips, the port's facts and its history. Reached from a port's name wherever one is shown.
 */
export function PortScreen() {
  const sailing = useSailing()
  const { id = '' } = useParams()
  const port = portById(id)
  const guide = usePortGuide(id)
  const favourites = useFavourites()
  if (!port && !guide) {
    return (
      <div className="page">
        <Banner kind="warning" title={t('discover.notFound.port')} action={<LinkButton to="/home/cruise" variant="secondary">{t('discover.seePlan')}</LinkButton>}>
          <p>{t('discover.notFound.body')}</p>
        </Banner>
      </div>
    )
  }
  const name = guide?.name ?? port?.name ?? id
  const day = itinerary(sailing).find((d) => d.port === id)
  const tender = (PORTS[id] ?? port)?.tender === true
  return (
    <div className="page port-details">
      <h2>{name}</h2>
      {guide?.area && <Area guide={guide} />}
      <p><span className={`tag${tender ? ' tag--alert' : ''}`}><Anchor aria-hidden="true" /> {tender ? t('discover.tender') : t('discover.dock')}</span>{tender && <StanleyExplain term="tender" />}{day && <> <span className="muted">{t('portguide.calls', { date: day.date })}</span></>}</p>
      <SaveShare kind="port" id={id} name={name} favourites={favourites} />
      {day && <SendToChat shareRef={`port:${id}`} title={name} />}
      {tender && day && <TenderOutlook port={id} date={day.date} />}

      {!guide && <FeedWaiting />}
      {guide && <GuideBody guide={guide} call={day?.arrive && day.allAboard ? { arrive: day.arrive, allAboard: day.allAboard, date: day.date } : null} tender={tender} />}
      <p><Link to="/home/cruise">{t('discover.backToCruise')}</Link> · <Link to="/home/ports">{t('portguide.list.all')}</Link></p>
    </div>
  )
}

/** The port's country line: the flag, the country name as a link to its Country Details page, then the rest of the area text ("Quintana Roo; Cozumel Island."). */
function Area({ guide }: { guide: NonNullable<ReturnType<typeof usePortGuide>> }) {
  if (!guide.countryId || !guide.countryName) return <p className="muted">{guide.area}</p>
  const at = guide.area.indexOf(' — ')
  const rest = at >= 0 ? guide.area.slice(at + 3) : ''
  return (
    <p className="muted port-details__area">
      <Flag code={guide.countryId} large /><Link to={`/home/countries/${guide.countryId}`}>{guide.countryName}</Link>{rest && ` — ${rest}`}
    </p>
  )
}

function GuideBody({ guide, call, tender }: { guide: NonNullable<ReturnType<typeof usePortGuide>>; call: { arrive: string; allAboard: string; date: string } | null; tender: boolean }) {
  const tiers = byTier(guide.attractions)
  const [picked, setPicked] = useState<string | null>(null)
  // Pins are numbered in the order the places are listed below (easiest to reach first), so a number on the map is a number in the list.
  const pins: MapPin[] = tiers.flatMap((g) => g.items).filter((a) => a.map && isLatLng(a.map)).map((a) => ({ id: a.name, label: a.name, at: a.map!, note: a.tier }))
  const pinNo = (name: string) => pins.findIndex((p) => p.id === name) + 1
  const pick = (id: string) => { setPicked(id); document.getElementById('pd-map')?.scrollIntoView({ block: 'nearest' }) }
  const rows = guide.stats ? FACTS.filter((f) => guide.stats?.[f.key]) : []
  const jumps: { id: string; label: StringKey }[] = [
    ...(guide.gettingAshore || guide.currencyLanguage || guide.officialLinks.length > 0 ? [{ id: 'pd-ashore-h', label: 'discover.gettingAshore' as StringKey }] : []),
    ...(tiers.length > 0 ? [{ id: 'pd-do-h', label: 'discover.thingsToDo' as StringKey }] : []),
    ...(guide.tips.length > 0 ? [{ id: 'pd-tips-h', label: 'portguide.tips' as StringKey }] : []),
    ...(rows.length > 0 ? [{ id: 'pd-facts-h', label: 'portguide.facts' as StringKey }] : []),
    ...(guide.stats && guide.stats.timeline.length > 0 ? [{ id: 'pd-history-h', label: 'portguide.history' as StringKey }] : []),
  ]
  return (
    <>
      {guide.shortDescription && <p className="port-details__lead">{guide.shortDescription}</p>}
      {guide.longDescription && <p>{guide.longDescription}</p>}

      {jumps.length > 1 && (
        <nav aria-label={t('portguide.jump')}>
          <ul className="naut-jump">
            {jumps.map((j) => <li key={j.id}><a href={`#${j.id}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(j.id); el?.scrollIntoView({ block: 'start' }); el?.focus() }}><PillIcon label={t(j.label)} />{th(j.label)}</a></li>)}
          </ul>
        </nav>
      )}

      {(guide.gettingAshore || guide.currencyLanguage || guide.officialLinks.length > 0) && (
        <section aria-labelledby="pd-ashore-h" data-tour="pd-ashore">
          <Card info labelledBy="pd-ashore-h">
            <h2 id="pd-ashore-h" tabIndex={-1}><PillIcon heading label={th('discover.gettingAshore')} />{th('discover.gettingAshore')}</h2>
            {guide.gettingAshore && <p>{guide.gettingAshore}</p>}
            {guide.currencyLanguage && <p><strong>{t('portguide.currencyLanguage')}</strong> {guide.currencyLanguage}</p>}
            {guide.officialLinks.length > 0 && <LinkRow label={t('portguide.official')} links={guide.officialLinks} />}
          </Card>
        </section>
      )}

      {tiers.length > 0 && (
        <section aria-labelledby="pd-do-h">
          <h2 id="pd-do-h" tabIndex={-1}><PillIcon heading label={th('discover.thingsToDo')} />{th('discover.thingsToDo')}</h2>
          <p className="muted">{t('portguide.attractionsNote')}</p>
          {pins.length > 1 && (
            <Card info>
              <div id="pd-map" tabIndex={-1}>
                <PlaceMap title={t('maps.portTitle')} pins={pins} selectedId={picked} onSelect={setPicked} />
                <p className="muted">{t('maps.portNote')}</p>
              </div>
            </Card>
          )}
          {call && <Card info><PortDayPlanner attractions={guide.attractions} arrive={call.arrive} allAboard={call.allAboard} tender={tender} date={call.date} port={guide.id} /></Card>}
          {tiers.map((g) => (
            <div key={g.tier} role="group" aria-label={g.tier}>
              <h3>{g.tier}</h3>
              <ul className="card-grid">{g.items.map((a) => <AttractionCard key={a.name} a={a} pin={pinNo(a.name)} picked={picked === a.name} onShow={pick} />)}</ul>
            </div>
          ))}
        </section>
      )}

      {guide.tips.length > 0 && (
        <section aria-labelledby="pd-tips-h">
          <h2 id="pd-tips-h" tabIndex={-1}><PillIcon heading label={th('portguide.tips')} />{th('portguide.tips')}</h2>
          <ul className="port-details__tips">{guide.tips.map((tip) => <li key={tip.title}>{tip.title && <strong>{tip.title}. </strong>}{tip.text}</li>)}</ul>
        </section>
      )}

      {guide.stats && <Facts stats={guide.stats} />}
      <p className="muted">{t('portguide.verify')}</p>
    </>
  )
}

function AttractionCard({ a, pin, picked, onShow }: { a: GuideAttraction; pin: number; picked: boolean; onShow: (id: string) => void }) {
  return (
    <li className={`card port-details__place${picked ? ' port-details__place--on' : ''}`}>
      <h4>{pin > 0 && <span className="port-details__pin" aria-label={`${pin}.`}>{pin}</span>}{a.name}{a.aka && <span className="muted"> {a.aka}</span>}</h4>
      {a.why && <p>{a.why}</p>}
      {a.logistics.length > 0 && <dl className="port-details__logistics">{a.logistics.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.text}</dd></div>)}</dl>}
      <p className="row">
        {pin > 0 && <button type="button" className="btn btn--secondary" aria-pressed={picked} onClick={() => onShow(a.name)}>{t('maps.show')}<span className="visually-hidden"> {a.name}</span></button>}
        {a.map && <a className="btn btn--secondary" href={directionsUrl(a.map)} target="_blank" rel="noreferrer">{t('portguide.directions')}<span className="visually-hidden"> {a.name} {t('portguide.newTab')}</span></a>}
        {a.map && <a href={mapUrl(a.map)} target="_blank" rel="noreferrer">{t('portguide.map')}<span className="visually-hidden"> {a.name} {t('portguide.newTab')}</span></a>}
        {a.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label}<span className="visually-hidden"> {t('portguide.newTab')}</span></a>)}
      </p>
    </li>
  )
}

function LinkRow({ label, links }: { label: string; links: readonly GuideLink[] }) {
  return (
    <p><strong>{label}</strong>{' '}{links.map((l, i) => <span key={l.url}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noreferrer">{l.label}<span className="visually-hidden"> {t('portguide.newTab')}</span></a></span>)}</p>
  )
}

const FACTS: readonly { key: keyof GuideStats; label: StringKey }[] = [
  { key: 'population', label: 'portguide.fact.population' },
  { key: 'landSize', label: 'portguide.fact.landSize' },
  { key: 'neighbours', label: 'portguide.fact.neighbours' },
  { key: 'safety', label: 'portguide.fact.safety' },
  { key: 'government', label: 'portguide.fact.government' },
  { key: 'economy', label: 'portguide.fact.economy' },
  { key: 'famousPeople', label: 'portguide.fact.famousPeople' },
  { key: 'vibe', label: 'portguide.fact.vibe' },
]

function Facts({ stats }: { stats: GuideStats }) {
  const rows = FACTS.filter((f) => stats[f.key])
  return (
    <>
      {rows.length > 0 && (
        <section aria-labelledby="pd-facts-h">
          <h2 id="pd-facts-h" tabIndex={-1}><PillIcon heading label={th('portguide.facts')} />{th('portguide.facts')}</h2>
          {stats.intro && <p>{stats.intro}</p>}
          <dl className="port-details__facts">{rows.map((f) => <div key={f.key}><dt>{t(f.label)}</dt><dd>{stats[f.key] as string}</dd></div>)}</dl>
        </section>
      )}
      {stats.timeline.length > 0 && (
        <section aria-labelledby="pd-history-h">
          <h2 id="pd-history-h" tabIndex={-1}><PillIcon heading label={th('portguide.history')} />{th('portguide.history')}</h2>
          <ol className="port-details__timeline">{stats.timeline.map((e) => <li key={`${e.when}${e.text}`}><strong>{e.when}</strong> {e.text}</li>)}</ol>
        </section>
      )}
    </>
  )
}
