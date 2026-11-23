import { useMemo, useState, type CSSProperties } from 'react'
import { Lock, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { COLS, MAX_ROUNDS, MAX_SCORE, allGaps, colOf, fill, finished, hint as findHint, lockedCount, lockedMask, newGame, nextRound, roundOver, rowOf, score, type Gaps } from '../../../games/domain/gaps'
import { clock } from '../../../games/domain/sudoku'
import { t } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { CardCredits, CardTable, CardView } from './cards/CardParts'
import { CARD_RATIO, cardName } from './cards/cardArt'
import { useCardGame } from './cards/useCardGame'
import { usePanZoom } from './cards/usePanZoom'
import { GameClock, GameHelp, HintBox, SolvedCard } from './parts'
import { useGameClock } from './gameHooks'

/** The board's geometry, in card widths, shared by the CSS grid and the view maths. */
const PAD = 0.2, LABEL = 0.55, GAP = 0.08, HEADER = 0.45
const KX = 2 * PAD + LABEL + (COLS + 1) * GAP + COLS
const KY = 2 * PAD + HEADER + 5 * GAP + 4 * CARD_RATIO
const cellX = (c: number) => PAD + LABEL + GAP + c * (1 + GAP)
const cellY = (r: number) => PAD + HEADER + GAP + r * (CARD_RATIO + GAP)
const GLYPH = ['♠', '♥', '♦', '♣']
const HEADS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', '']

interface Shown { text: string; gap: number; from: number }

/**
 * Gaps: four rows of thirteen with the Aces out. Fill a gap with the card that follows the one on its left, in suit; a gap in the first column takes a 2; a gap right of a King is dead.
 * Three rounds, then the locked cards add up to your score. The board is bigger than a phone, so it pans and pinch-zooms. Nothing is stored.
 */
export function GapsScreen() {
  const game = useCardGame<Gaps>(() => newGame())
  const g = game.state
  const [picking, setPicking] = useState<number | null>(null)
  const [held, setHeld] = useState<number | null>(null)
  const [hint, setHint] = useState<Shown | null>(null)
  const [note, setNote] = useState('')
  const over = finished(g)
  const between = roundOver(g.board) && !over
  const { seconds, reset: resetClock } = useGameClock(!over)
  const pz = usePanZoom({ kx: KX, ky: KY, maxHeight: 460, startCw: 46, maxCw: 104 })

  const locked = useMemo(() => lockedMask(g.board), [g.board])
  const gaps = useMemo(() => allGaps(g.board), [g.board])
  const info = useMemo(() => new Map(gaps.map((x) => [x.index, x])), [gaps])
  const points = score(g.board)
  const lockedN = lockedCount(g.board)

  const reveal = (index: number) => pz.reveal(cellX(colOf(index)), cellY(rowOf(index)), 1, CARD_RATIO)
  const clear = () => { setPicking(null); setHeld(null); setHint(null); setNote('') }
  const doFill = (gap: number, from: number) => {
    const next = fill(g, gap, from)
    if (next === g) return
    game.commit(next)
    clear()
    reveal(from) // the gap moves to where the card was
  }
  const newDeal = () => { game.restart(newGame()); clear(); resetClock() }
  const shuffle = () => { game.restart(nextRound(g)); clear() }

  const tapGap = (i: number) => {
    if (pz.dragged() || over || between) return
    const x = info.get(i)
    if (!x) return
    if (x.state === 'dead') { setNote(t(colOf(i) === 0 ? 'gp.dead.none' : 'gp.dead')); return }
    if (x.state === 'waiting') { setNote(t('gp.waiting')); return }
    if (x.options.length === 1) { doFill(i, x.options[0]); return }
    if (held !== null && x.options.includes(held)) { doFill(i, held); return }
    setPicking(i); setHeld(null); setHint(null)
    setNote(t('gp.pick2'))
    reveal(x.options[0])
  }
  const tapCard = (i: number) => {
    if (pz.dragged() || over || between) return
    const targets = gaps.filter((x) => x.state === 'ready' && x.options.includes(i))
    if (targets.length === 0) { setNote(locked[i] ? t('gp.locked.note') : t('gp.nofill', { card: cardName(g.board[i]!) })); return }
    if (picking !== null && targets.some((x) => x.index === picking)) { doFill(picking, i); return }
    if (targets.length === 1) { doFill(targets[0].index, i); return }
    setHeld(i); setPicking(null); setHint(null)
    setNote(t('gp.pickGap'))
  }

  const showHint = () => {
    const h = findHint(g)
    if (!h) { setNote(t('gp.hint.none')); return }
    const card = g.board[h.from]!
    setPicking(null); setHeld(null)
    setHint({ text: colOf(h.gap) === 0 ? t('gp.hint.two', { card: cardName(card), row: rowOf(h.gap) + 1 }) : t('gp.hint.fill', { card: cardName(card), row: rowOf(h.gap) + 1, col: colOf(h.gap) + 1 }), gap: h.gap, from: h.from })
    reveal(h.gap)
  }
  const nextGap = () => {
    const x = gaps.find((y) => y.state === 'ready')
    if (x) reveal(x.index)
  }

  const optionSet = new Set<number>([...(picking !== null ? info.get(picking)?.options ?? [] : []), ...(hint ? [hint.from] : [])])
  const heldGaps = new Set<number>(held !== null ? gaps.filter((x) => x.state === 'ready' && x.options.includes(held)).map((x) => x.index) : [])
  const rowSuit = (r: number): number | null => { const c = g.board[r * COLS]; return c && locked[r * COLS] ? c.suit : null }

  const boardStyle = { '--cw': `${pz.view.cw}px`, transform: `translate(${pz.view.x}px, ${pz.view.y}px)` } as CSSProperties
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const won = lockedN === 48

  return (
    <div className="page">
      <div className="cg">
        <div className="game-bar">
          <p className="gp-round" role="status">{t('gp.round', { n: g.round, of: MAX_ROUNDS })}</p>
          <Button variant="secondary" onClick={newDeal}>{t('gp.new')}</Button>
        </div>

        <CardTable cols={13}>
          <p className="pc-hud">
            <GameClock seconds={seconds} label={t('sudoku.time')} />
            <span>{t('gp.locked', { n: lockedN })}</span>
            <span>{t('gp.score', { n: points, max: MAX_SCORE })}</span>
          </p>
          <div ref={pz.ref} className="gp-view" role="group" aria-label={t('gp.board')} style={{ height: pz.height }} {...pz.handlers}>
            <div className={`gp-board ${pz.glide ? 'gp-board--glide' : ''}`} style={boardStyle}>
              <span />
              {HEADS.map((h, c) => <span key={c} className="gp-head" aria-hidden="true">{h}</span>)}
              {Array.from({ length: 4 }, (_, r) => {
                const suit = rowSuit(r)
                return [
                  <span key={`l${r}`} className={`gp-label ${suit !== null ? 'gp-label--set' : ''}`} style={{ color: suit === 1 || suit === 2 ? '#ff9a8f' : undefined }} aria-hidden="true">{suit !== null ? GLYPH[suit] : '?'}</span>,
                  ...Array.from({ length: COLS }, (_, c) => {
                    const i = r * COLS + c
                    const card = g.board[i]
                    if (card) {
                      const cls = ['pc', 'pc--up', locked[i] ? 'pc--locked' : '', optionSet.has(i) ? 'pc--hint' : ''].join(' ')
                      return (
                        <div key={i} className="pc-pile">
                          <button type="button" className={cls} aria-label={`${cardName(card)}${locked[i] ? `, ${t('gp.lockedWord')}` : ''}`} onFocus={() => reveal(i)} onClick={() => tapCard(i)}>
                            <CardView card={card} />
                            {locked[i] && <Lock className="gp-lock" aria-hidden="true" focusable="false" />}
                          </button>
                        </div>
                      )
                    }
                    const x = info.get(i)!
                    const need = x.state === 'ready' && x.options.length === 1 ? g.board[x.options[0]] : null
                    const label = x.state === 'dead' ? t('gp.gap.dead', { row: r + 1, col: c + 1 }) : x.state === 'waiting' ? t('gp.gap.waiting', { row: r + 1, col: c + 1 }) : need ? t('gp.gap.fill', { row: r + 1, col: c + 1, card: cardName(need) }) : t('gp.gap.two', { row: r + 1, col: c + 1 })
                    return (
                      <div key={i} className="pc-pile">
                        <button type="button" className={`gp-gap gp-gap--${x.state} ${picking === i || heldGaps.has(i) || hint?.gap === i ? 'gp-gap--on' : ''}`} aria-label={label} onFocus={() => reveal(i)} onClick={() => tapGap(i)}>
                          {x.state === 'ready' && need && <CardView card={need} className="gp-ghost" />}
                          {x.state === 'ready' && !need && <span className="gp-two" aria-hidden="true">2</span>}
                          {x.state === 'dead' && <span className="gp-x" aria-hidden="true">✕</span>}
                          {x.state === 'waiting' && <span className="gp-wait" aria-hidden="true">…</span>}
                        </button>
                      </div>
                    )
                  }),
                ]
              })}
            </div>
            <div className="gp-zoom" onPointerDown={stop} onPointerUp={stop}>
              <button type="button" aria-label={t('gp.zoomIn')} onClick={() => pz.zoomBy(1.3)}><ZoomIn aria-hidden="true" focusable="false" /></button>
              <button type="button" aria-label={t('gp.zoomOut')} onClick={() => pz.zoomBy(1 / 1.3)}><ZoomOut aria-hidden="true" focusable="false" /></button>
              <button type="button" aria-label={t('gp.fit')} onClick={pz.fit}><Maximize2 aria-hidden="true" focusable="false" /></button>
            </div>
          </div>
        </CardTable>

        <p className="cg-note" role="status" aria-live="polite">{note || (picking !== null ? t('gp.pick2') : t('gp.start'))}</p>
        {hint && <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}><Button variant="secondary" onClick={() => doFill(hint.gap, hint.from)}>{t('kl.hint.do')}</Button></HintBox>}

        {between && (
          <SolvedCard title={t('gp.roundOver', { n: g.round })}>
            <p>{t('gp.roundBody', { locked: lockedN, score: points })}</p>
            <div className="button-row"><Button onClick={shuffle}>{t('gp.shuffle', { n: g.round + 1 })}</Button></div>
          </SolvedCard>
        )}
        {over && (
          <SolvedCard title={won ? t('gp.won') : t('gp.over')}>
            <p>{won ? t('gp.wonBody', { score: points, time: clock(seconds), round: g.round }) : t('gp.overBody', { score: points, max: MAX_SCORE, locked: lockedN })}</p>
            <div className="button-row"><Button onClick={newDeal}>{t('gp.new')}</Button></div>
          </SolvedCard>
        )}

        <div className="cg-tools" style={{ '--tools': 3 } as CSSProperties}>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); clear() }} disabled={!game.canUndo}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <button type="button" className="sd-tool" onClick={showHint} disabled={over || between}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
          <button type="button" className="sd-tool" onClick={nextGap} disabled={over || between}><span>{t('gp.nextGap')}</span></button>
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('gp.help.1')}</p>
          <p>{t('gp.help.2')}</p>
          <p>{t('gp.help.3')}</p>
        </GameHelp>
        <CardCredits />
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
