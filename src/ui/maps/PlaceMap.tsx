import { useId, useMemo, useState } from 'react'
import { t } from '../../i18n'
import { distanceKm, legsKm, project, scaleBar, walkMinutes, walkingDistanceLabel, type LatLng, type Pace } from '../../maps/geo'
import { directionsToUrl, embedKey, embedUrl, placeUrl, walkingRouteUrl } from '../../maps/googleMaps'

export interface MapPin { id: string; label: string; at: LatLng; /** Smaller text under the label, such as the access tier. */ note?: string }

const W = 560
const H = 360

/**
 * A map drawn by us from coordinates: numbered pins, an optional walking route in the order given, and a scale bar. It needs no tiles, key or network,
 * so it works offline and sends nothing to anyone. The list under it is the same information in text and is the keyboard route (a pin is also
 * clickable). "Open in Google Maps" opens Google's own map on the guest's device; a Google embed is offered only when a key was set at build time, and it
 * loads only after the guest asks for it. (docs/mcp-integration-plan.md, phase 1)
 */
export function PlaceMap({ title, pins, route = false, pace = 'steady', selectedId, onSelect, startLabel }: {
  title: string
  pins: readonly MapPin[]
  /** Draw and list the walk from pin to pin in the order given. */
  route?: boolean
  pace?: Pace
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Names an unlabelled starting point (the first pin) in the route text, such as "the ship". */
  startLabel?: string
}) {
  const uid = useId()
  const [embedded, setEmbedded] = useState(false)
  const shape = useMemo(() => project(pins.map((p) => p.at), W, H), [pins])
  const bar = useMemo(() => scaleBar(shape), [shape])
  const legs = useMemo(() => (route ? legsKm(pins.map((p) => p.at)) : []), [pins, route])
  const key = embedKey()
  const embed = embedded ? embedUrl(key, route ? pins.map((p) => p.at) : pins.length === 1 ? [pins[0].at] : []) : null
  if (pins.length === 0) return null
  const open = route && pins.length > 1 ? walkingRouteUrl(pins.map((p) => p.at)) : pins.length === 1 ? placeUrl(pins[0].at) : null
  const totalKm = legs.reduce((s, k) => s + k, 0)
  const canEmbed = !!key && (route ? pins.length > 1 : pins.length === 1)

  return (
    <figure className="place-map">
      <figcaption id={`${uid}-t`}><strong>{title}</strong></figcaption>
      <svg className="place-map__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${uid}-t ${uid}-d`} focusable="false">
        <desc id={`${uid}-d`}>{route ? t('maps.routeDesc', { count: pins.length, km: totalKm.toFixed(1) }) : t('maps.pinsDesc', { count: pins.length })}</desc>
        <rect className="place-map__bg" x="0" y="0" width={W} height={H} rx="8" />
        {route && pins.length > 1 && <polyline className="place-map__route" points={shape.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />}
        {bar && (
          <g className="place-map__scale" transform={`translate(16 ${H - 16})`} aria-hidden="true">
            <line x1="0" y1="0" x2={bar.units} y2="0" />
            <line x1="0" y1="-4" x2="0" y2="4" />
            <line x1={bar.units} y1="-4" x2={bar.units} y2="4" />
            <text x={bar.units + 6} y="4">{bar.label}</text>
          </g>
        )}
        {pins.map((p, i) => {
          const at = shape.points[i]
          const on = p.id === selectedId
          return (
            <g key={p.id} className={`place-map__pin${on ? ' place-map__pin--on' : ''}`} transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`} onClick={onSelect ? () => onSelect(p.id) : undefined} aria-hidden="true">
              <circle r={on ? 15 : 12} />
              <text y="4.5" textAnchor="middle">{i + 1}</text>
            </g>
          )
        })}
      </svg>
      <ol className="place-map__list">
        {pins.map((p, i) => {
          const km = i > 0 && route ? legs[i - 1] : null
          const on = p.id === selectedId
          return (
            <li key={p.id} className={on ? 'place-map__item place-map__item--on' : 'place-map__item'} aria-current={on ? 'true' : undefined}>
              {onSelect ? <button type="button" className="link-button" onClick={() => onSelect(p.id)}>{p.label}</button> : <span>{p.label}</span>}
              {p.note && <span className="muted"> · {p.note}</span>}
              {route && (
                <span className="muted"> · {km === null ? (startLabel ? t('maps.startAt', { place: startLabel }) : t('maps.start')) : t('maps.leg', { time: walkMinutes(km, pace), distance: walkingDistanceLabel(km) })}</span>
              )}
              {' '}<a href={directionsToUrl(p.at) ?? undefined} target="_blank" rel="noreferrer">{t('portguide.directions')}<span className="visually-hidden"> {p.label} {t('portguide.newTab')}</span></a>
            </li>
          )
        })}
      </ol>
      {route && pins.length > 1 && <p className="muted">{t('maps.total', { time: walkMinutes(totalKm, pace), distance: walkingDistanceLabel(totalKm) })}</p>}
      {pins.length > 1 && !route && <p className="muted">{t('maps.spread', { distance: walkingDistanceLabel(Math.max(...pins.map((p) => distanceKm(pins[0].at, p.at)))) })}</p>}
      <p className="row">
        {open && <a className="btn btn--secondary" href={open} target="_blank" rel="noreferrer">{t('maps.openGoogle')}<span className="visually-hidden"> {t('portguide.newTab')}</span></a>}
        {canEmbed && !embedded && <button type="button" className="btn btn--secondary" onClick={() => setEmbedded(true)}>{t('maps.showGoogle')}</button>}
      </p>
      {embed && (
        <>
          <iframe className="place-map__embed" title={t('maps.embedTitle', { title })} src={embed} loading="lazy" referrerPolicy="origin" allowFullScreen />
          <p className="muted">{t('maps.embedNote')}</p>
        </>
      )}
      <p className="muted">{t('maps.approx')}</p>
    </figure>
  )
}
