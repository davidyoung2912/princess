import { useRef } from 'react'
import { Link } from 'react-router'
import { t, th, type StringKey } from '../../i18n'
import { favouritePath, parseFavouriteKey } from '../../domain/favourites'
import { browseSailingById, rangeOf } from '../../domain/catalogueBrowse'
import { portById } from '../../domain/sailings'
import { shipById, shipOf } from '../../domain/shipCatalogue'
import { useCatalogue } from '../../hooks/useCatalogue'
import { useFavourites } from '../../hooks/useFavourites'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { useSailing } from '../../hooks/useDemo'
import { NicknameCard, RemindCard } from '../delights/PrepareDelights'

/** What the guest has saved, with a way to remove each and a way to start saving. */
export function SavedScreen() {
  useCatalogue()
  const favourites = useFavourites()
  const sailing = useSailing()
  const heading = useRef<HTMLHeadingElement>(null)
  const items = favourites.keys.flatMap((key) => {
    const p = parseFavouriteKey(key)
    if (!p) return []
    const found = p.kind === 'sailing' ? browseSailingById(p.id) : null
    const name = p.kind === 'sailing' ? (found ? `${found.title}, ${rangeOf(found)}` : null) : p.kind === 'port' ? portById(p.id)?.name ?? null : (shipById(p.id) ?? (shipOf(sailing.id).id === p.id ? shipOf(sailing.id) : undefined))?.name ?? null
    return name ? [{ key, name, kind: p.kind, path: favouritePath(p.kind, p.id) }] : []
  })
  return (
    <div className="page">
      <h2 ref={heading} tabIndex={-1}>{th('route.saved')}</h2>
      {!favourites.ready && <p role="status" className="muted">{t('discover.loading')}</p>}
      {favourites.failed && <p role="alert">{t('discover.saveFailed')}</p>}
      {favourites.ready && items.length === 0 && (
        <Card info>
          <p>{t('discover.savedEmpty')}</p>
          <div className="button-row">
            <LinkButton to="/home/sailings">{t('discover.seeDates')}</LinkButton>
            <LinkButton to="/home/ships" variant="secondary">{t('cat.shipsLink')}</LinkButton>
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
      {items.filter((i) => i.kind === 'sailing').length >= 2 && <p><Link to="/home/saved/compare">{t('cat.compareSaved')}</Link></p>}
      <NicknameCard />
      <RemindCard sailingId={sailing.id} />
    </div>
  )
}
