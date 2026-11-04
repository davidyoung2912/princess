import { useCatalogue } from '../../hooks/useCatalogue'
import { useId } from 'react'
import { ELEVATORS, type Place } from '../../domain/deck'
import { HULL_PATH, PLAN_H, PLAN_W, SECTION_DIVIDERS, SECTION_LABEL_X, placeLifts, placePlaces, type Point } from '../../domain/deckPlan'
import { t, type StringKey } from '../../i18n'

interface Props {
  deck: number
  /** Mark places with steps. */
  stepFree?: boolean
  /** Show the quiet-space layer. */
  quiet?: boolean
  /** The place the guest says they are at ("you are here"); shown only on its deck. */
  here?: Place | null
  /** The place where the guest parked a lounger or table (DL7); shown only on its deck, with a square mark and a word. */
  pin?: Place | null
  /** A route to draw on this deck. */
  line?: Point[]
}

/**
 * The graphic deck plan (N5.1): an inline SVG drawn from the places, lift banks and muster stations the text list uses, so the two always agree.
 * The picture is for sighted use; every fact on it is also in the numbered key under it and in the deck table, and the plan itself is
 * described as one image. Marks never rely on colour alone: a muster station has a letter, a quiet space a ring and a step a dashed outline.
 */
export function DeckPlan({ deck, stepFree = false, quiet = false, here = null, pin = null, line = [] }: Props) {
  useCatalogue()
  const id = useId()
  const placed = placePlaces(deck)
  const lifts = placeLifts()
  const quietCount = placed.filter((p) => p.quiet).length
  return (
    <figure className="deck-plan">
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a region that scrolls sideways must be reachable by keyboard (WCAG 2.1.1) */}
      <div className="deck-plan__scroll" tabIndex={0} role="group" aria-label={t('plan2.scroll')}>
        <svg viewBox={`0 0 ${PLAN_W} ${PLAN_H}`} className="deck-plan__svg" role="img" aria-labelledby={`${id}-t ${id}-d`}>
          <title id={`${id}-t`}>{t('map.deck', { deck })}</title>
          <desc id={`${id}-d`}>{t('plan2.desc', { count: placed.length, lifts: lifts.length })}</desc>
          <path d={HULL_PATH} className="deck-plan__hull" />
          {SECTION_DIVIDERS.map((x) => <line key={x} x1={x} x2={x} y1={26} y2={174} className="deck-plan__divider" />)}
          {(['forward', 'midship', 'aft'] as const).map((s) => <text key={s} x={SECTION_LABEL_X[s]} y={16} textAnchor="middle" className="deck-plan__section">{t(`map.section.${s}` as StringKey)}</text>)}
          <line x1={20} x2={620} y1={100} y2={100} className="deck-plan__hall" />
          {lifts.map((l) => (
            <g key={l.bank}>
              <rect x={l.at.x - 10} y={l.at.y - 10} width={20} height={20} rx={3} className="deck-plan__lift" />
              <text x={l.at.x} y={l.at.y + 4} textAnchor="middle" className="deck-plan__lift-text">{l.bank}</text>
            </g>
          ))}
          {line.length > 1 && <polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} className="deck-plan__route" />}
          {placed.map((p, i) => (
            <g key={p.place.id} className={`deck-plan__place${quiet && p.quiet ? ' deck-plan__place--quiet' : ''}${stepFree && !p.place.stepFree ? ' deck-plan__place--steps' : ''}`}>
              {quiet && p.quiet && <circle cx={p.at.x} cy={p.at.y} r={17} className="deck-plan__quiet-ring" />}
              <circle cx={p.at.x} cy={p.at.y} r={12} className="deck-plan__dot" />
              <text x={p.at.x} y={p.at.y + 4} textAnchor="middle" className="deck-plan__num">{i + 1}</text>
              {p.muster && <text x={p.at.x + 14} y={p.at.y - 10} className="deck-plan__muster">{p.muster}</text>}
            </g>
          ))}
          {here && here.deck === deck && (() => {
            const spot = placed.find((p) => p.place.id === here.id)?.at ?? { x: 320, y: 100 }
            return <g><circle cx={spot.x} cy={spot.y} r={20} className="deck-plan__here" /><text x={spot.x} y={spot.y + 34} textAnchor="middle" className="deck-plan__here-text">{t('plan2.you')}</text></g>
          })()}
          {pin && pin.deck === deck && (() => {
            const spot = placed.find((p) => p.place.id === pin.id)?.at ?? { x: 320, y: 100 }
            return <g><rect x={spot.x - 18} y={spot.y - 18} width={36} height={36} rx={4} className="deck-plan__pin" /><text x={spot.x} y={spot.y + 34} textAnchor="middle" className="deck-plan__here-text">{t('dl7.spot.pin')}</text></g>
          })()}
        </svg>
      </div>
      <figcaption>
        <ol className="deck-plan__key">
          {placed.map((p) => (
            <li key={p.place.id} value={placed.indexOf(p) + 1}>
              {p.place.name}
              {p.muster ? ` · ${t('map.station', { letter: p.muster })}` : ''}
              {stepFree && !p.place.stepFree ? ` · ${t('onb.notStepFree')}` : ''}
              {quiet && p.quiet ? ` · ${t('plan2.quietSpace')}` : ''}
            </li>
          ))}
        </ol>
        {placed.length === 0 && <p className="muted">{t('map.empty')}</p>}
        {quiet && quietCount === 0 && <p className="muted">{t('plan2.noQuiet')}</p>}
        <p className="muted">{t('plan2.lifts', { banks: ELEVATORS.map((e) => e.bank).join(', ') })}</p>
      </figcaption>
    </figure>
  )
}
