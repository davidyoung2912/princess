import { DECKS } from '../../domain/deck'
import { t } from '../../i18n'

interface Props {
  deck: number
  onPick: (deck: number) => void
}

/**
 * A side view of the ship (Q6): one band per deck, tap a band to choose that deck. It is a set of real buttons with the deck number as text,
 * so it works by keyboard and screen reader exactly like the chip row beside it; the silhouette is decoration.
 */
export function DeckElevation({ deck, onPick }: Props) {
  const decks = DECKS.slice().reverse()
  return (
    <nav className="deck-elev" aria-label={t('l7.elev')}>
      <ol className="deck-elev__stack">
        {decks.map((d) => (
          <li key={d}>
            <button type="button" className="deck-elev__deck" aria-pressed={d === deck} aria-label={t('map.deck', { deck: d })} onClick={() => onPick(d)}>
              <span aria-hidden="true">{d}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
