import type { CSSProperties, ReactNode } from 'react'
import { t } from '../../../../../shared/i18n'
import type { Card } from '../../../../games/domain/cards'
import { CARD_RATIO, cardHref, cardName } from './cardArt'

/** The pieces the four card games share: a card, a stack of cards, an empty slot and the table they sit on. */

/** How far down each card sits from the one before, as a fraction of a card's width: a face-down card shows a sliver, a face-up one shows its corner index. */
const DOWN_STEP = 0.16
const UP_STEP = 0.4

export interface StackCard {
  card: Card
  down?: boolean
  selected?: boolean
  hint?: boolean
}

/** One card, drawn from the artwork. `edge` draws only the corner of it (the card base and index), used for cards that are covered. */
export function CardView({ card, edge = false, className = '', ...rest }: { card: Card; edge?: boolean; className?: string } & Omit<React.SVGProps<SVGSVGElement>, 'ref'>) {
  return (
    <svg className={`pc__art ${className}`} viewBox="0 0 169.075 244.64" aria-hidden="true" focusable="false" {...rest}>
      <use href={cardHref(card, edge)} />
    </svg>
  )
}

/** The back of a card: Princess Voyages navy with the roundel (drawn by CSS, so it costs almost nothing however many are on the table). */
export function CardBack({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`pc pc--back ${className}`} style={style} aria-hidden="true" />
}

/** Cumulative top offsets (in card widths) for a stack, squeezed when the column would otherwise be too tall. */
function stackOffsets(cards: readonly StackCard[], maxHeight: number): { ys: number[]; height: number } {
  const steps = cards.slice(0, -1).map((c) => (c.down ? DOWN_STEP : UP_STEP))
  const sum = steps.reduce((a, b) => a + b, 0)
  const room = maxHeight - CARD_RATIO
  const scale = sum > room && sum > 0 ? Math.max(0.55, room / sum) : 1
  const ys: number[] = [0]
  for (const s of steps) ys.push(ys[ys.length - 1] + s * scale)
  return { ys, height: (ys[ys.length - 1] ?? 0) + CARD_RATIO }
}

interface StackProps {
  cards: readonly StackCard[]
  label: string
  /** Called with the index of the tapped face-up card. */
  onTap?: (index: number) => void
  /** Called when the empty slot is tapped. */
  onEmpty?: () => void
  emptyLabel: string
  empty?: ReactNode
  hintEmpty?: boolean
  maxHeight?: number
  /** Where this stack sits in the deal, for the staggered deal-in. */
  k0?: number
}

/** A column of overlapping cards (or an empty slot). The covered cards are drawn as edges; only the top card is drawn in full. */
export function Stack({ cards, label, onTap, onEmpty, emptyLabel, empty, hintEmpty, maxHeight = 9, k0 = 0 }: StackProps) {
  const { ys, height } = stackOffsets(cards, maxHeight)
  const style = { height: `calc(var(--cw) * ${height})` } as CSSProperties
  const down = cards.filter((c) => c.down).length
  return (
    <div className="pc-stack" role="group" aria-label={`${label}${down ? `, ${t('cd.facedown', { n: down })}` : ''}`} style={style}>
      {cards.length === 0 && (
        <button type="button" className={`pc-slot ${hintEmpty ? 'pc-slot--hint' : ''}`} aria-label={emptyLabel} onClick={onEmpty}>{empty}</button>
      )}
      {cards.map((c, i) => {
        const last = i === cards.length - 1
        const h = last ? CARD_RATIO : ys[i + 1] - ys[i]
        const pos = { top: `calc(var(--cw) * ${ys[i]})`, height: `calc(var(--cw) * ${h})`, '--k': k0 + i } as CSSProperties
        if (c.down) return <CardBack key={c.card.id} className={last ? '' : 'pc--strip'} style={pos} />
        const cls = ['pc', 'pc--up', last ? '' : 'pc--strip', c.selected ? 'pc--sel' : '', c.hint ? 'pc--hint' : ''].join(' ')
        return (
          <button key={c.card.id} type="button" className={cls} style={pos} aria-label={cardName(c.card)} aria-pressed={c.selected || undefined} onClick={() => onTap?.(i)}>
            <CardView card={c.card} edge={!last} />
          </button>
        )
      })}
    </div>
  )
}

/** One card on its own (a foundation top, a free cell, the waste), with an empty slot when there is none. `back` shows a face-down card instead (the stock). */
export function Single({ card, label, emptyLabel, empty, selected, hint, onTap, count, back, k = 0 }: {
  card: Card | null; label: string; emptyLabel: string; empty?: ReactNode; selected?: boolean; hint?: boolean; onTap?: () => void; count?: number; back?: boolean; k?: number
}) {
  const style = { '--k': k } as CSSProperties
  let body: ReactNode
  if (back) {
    body = (
      <button type="button" className={`pc pc--back pc--tap ${hint ? 'pc--hint' : ''}`} aria-label={`${label}, ${count ?? 0}`} onClick={onTap}>
        {count !== undefined && <span className="pc-count" aria-hidden="true">{count}</span>}
      </button>
    )
  } else if (!card) {
    body = <button type="button" className={`pc-slot ${hint ? 'pc-slot--hint' : ''}`} aria-label={emptyLabel} onClick={onTap}>{empty}</button>
  } else {
    body = (
      <button type="button" className={['pc', 'pc--up', selected ? 'pc--sel' : '', hint ? 'pc--hint' : ''].join(' ')} style={style} aria-label={`${label}, ${cardName(card)}`} aria-pressed={selected || undefined} onClick={onTap}>
        <CardView card={card} />
      </button>
    )
  }
  return <div className="pc-pile">{body}</div>
}

/** The felt the cards lie on. `cols` is how many cards fit across, so every card is as large as the screen allows. */
export function CardTable({ cols, children, fresh, className = '' }: { cols: number; children: ReactNode; fresh?: boolean; className?: string }) {
  return <div className={`pc-table ${fresh ? 'pc-table--fresh' : ''} ${className}`} style={{ '--cols': cols } as CSSProperties}>{children}</div>
}

/** Credit for the card artwork, as the licence asks: who made it, the licence, where the source is, and that it was modified. */
export function CardCredits() {
  return (
    <details className="game-help pc-credits">
      <summary>{t('cd.credits.title')}</summary>
      <p>{t('cd.credits.body')}</p>
      <p>
        <a href="https://github.com/htdebeer/SVG-cards" target="_blank" rel="noopener noreferrer">{t('cd.credits.source')}</a>{' · '}
        <a href="/licenses/svg-cards-LGPL-2.1.txt" target="_blank" rel="noopener noreferrer">{t('cd.credits.licence')}</a>{' · '}
        <a href="/licenses/svg-cards-AUTHORS.txt" target="_blank" rel="noopener noreferrer">{t('cd.credits.authors')}</a>
      </p>
    </details>
  )
}
