import { deckMaps, type DeckMap } from '../../domain/cabinMap'
import type { Cabin } from '../../domain/cabins'
import { t } from '../../i18n'

/** A schematic of each deck (DSC-05): real buttons in a grid, so it works with a keyboard and a screen reader. Status is words, not colour alone. */
export function CabinMap({ cabins, selected, onPick }: { cabins: readonly Cabin[]; selected: string; onPick: (number: string) => void }) {
  return (
    <div className="cabin-map">
      {deckMaps(cabins).map((d) => <DeckGrid key={d.deck} map={d} selected={selected} onPick={onPick} />)}
    </div>
  )
}

function DeckGrid({ map, selected, onPick }: { map: DeckMap; selected: string; onPick: (n: string) => void }) {
  return (
    <section aria-labelledby={`cm-${map.deck}`} className="cabin-map__deck">
      <h4 id={`cm-${map.deck}`}>{t('book.cabin.deck', { deck: map.deck })}</h4>
      <p className="muted cabin-map__axis" aria-hidden="true">{t('book.map.axis')}</p>
      {map.rows.map((row) => (
        <div key={row.side} className="cabin-map__row" role="group" aria-label={t(`book.cabin.side.${row.side}`)}>
          {row.cells.map((cell) => (
            <div key={cell.position} className="cabin-map__cell" role="group" aria-label={`${t(`book.cabin.side.${row.side}`)}, ${t(`book.cabin.position.${cell.position}`)}`}>
              {cell.cabins.map((c) => (
                <button key={c.number} type="button" disabled={!c.available} aria-pressed={selected === c.number} className={`cabin-map__cabin${selected === c.number ? ' is-selected' : ''}`} onClick={() => onPick(c.number)}>
                  {c.number}<small>{c.available ? (selected === c.number ? t('book.map.chosen') : t('book.map.free')) : t('book.map.taken')}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
