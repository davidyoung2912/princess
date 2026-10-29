import { useRef } from 'react'
import { Link } from 'react-router'
import { t, type StringKey } from '../../i18n'
import { sailingRange } from '../../domain/cruise'
import { favouritePath, parseFavouriteKey } from '../../domain/favourites'
import { portGuideById } from '../../domain/ports'
import { PORTS, sailingById } from '../../domain/sailings'
import { SHIP } from '../../domain/ship'
import { useFavourites } from '../../hooks/useFavourites'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'

/** What the guest has saved, with a way to remove each and a way to start saving. */
export function SavedScreen() {
  const favourites = useFavourites()
  const heading = useRef<HTMLHeadingElement>(null)
  const items = favourites.keys.flatMap((key) => {
    const p = parseFavouriteKey(key)
    if (!p) return []
    const name = p.kind === 'sailing' ? (sailingById(p.id) ? sailingRange(sailingById(p.id)!) : null) : p.kind === 'port' ? (portGuideById(p.id) ? PORTS[portGuideById(p.id)!.id].name : null) : SHIP.name
    return name ? [{ key, name, kind: p.kind, path: favouritePath(p.kind, p.id) }] : []
  })
  return (
    <div className="page">
      <h1 ref={heading} tabIndex={-1}>{t('route.saved')}</h1>
      {!favourites.ready && <p role="status" className="muted">{t('discover.loading')}</p>}
      {favourites.failed && <p role="alert">{t('discover.saveFailed')}</p>}
      {favourites.ready && items.length === 0 && (
        <Card info>
          <p>{t('discover.savedEmpty')}</p>
          <div className="button-row">
            <LinkButton to="/home/sailings">{t('discover.seeDates')}</LinkButton>
            <LinkButton to="/home/ship" variant="secondary">{t('route.sunPrincess')}</LinkButton>
          </div>
        </Card>
      )}
      <ul className="plain-list">
        {items.map((i) => (
          <li key={i.key}>
            <span><Link to={i.path}>{i.name}</Link> <span className="muted">{t(`discover.kind.${i.kind}` as StringKey)}</span></span>
            <Button variant="tertiary" onClick={() => { void favourites.toggle(i.key); heading.current?.focus() }}>{t('discover.remove')}<span className="visually-hidden"> {i.name}</span></Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
