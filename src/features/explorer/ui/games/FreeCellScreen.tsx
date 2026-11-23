import { useEffect, useState } from 'react'
import { CELLS_OF, FREECELL_LEVELS, autoStep, bestDest, canAutoFinish, canMove, cardsOf, deal, hint as findHint, isRun, isWon, maxMovable, move, randomDeal, type Dst, type FreeCell, type FreeCellLevel, type Src, DEAL_COUNT, UNSOLVABLE_DEAL } from '../../../games/domain/freecell'
import { SUIT_NAMES } from '../../../games/domain/cards'
import { clock } from '../../../games/domain/sudoku'
import { startVisibleInterval } from '../../../../shared/hooks/visibleInterval'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { CardCredits, CardTable, Single, Stack, type StackCard } from './cards/CardParts'
import { cardName } from './cards/cardArt'
import { useCardGame } from './cards/useCardGame'
import { DealBar } from './cards/DealBar'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'
import { seededShare } from '../../../games/domain/share'

const LEVEL_KEYS: Record<FreeCellLevel, StringKey> = { classic: 'fc.level.classic', hard: 'fc.level.hard', expert: 'fc.level.expert' }
const GLYPH = ['♠', '♥', '♦', '♣']
const same = (a: Src | null, b: Src): boolean => !!a && JSON.stringify(a) === JSON.stringify(b)

/** FreeCell: every card face up, free cells for parking, numbered deals that can all be won. Tap a card, then where it goes; tap it again for its best place. Nothing is stored. */
export function FreeCellScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('freecell')
  const sent = incoming && incoming.shared.game === 'freecell' ? incoming.shared.puzzle : null
  const [level, setLevel] = useState<FreeCellLevel>((sent?.level as FreeCellLevel) ?? 'classic')
  const game = useCardGame<FreeCell>(() => deal(level, sent?.seed ?? randomDeal()))
  const g = game.state
  const [sel, setSel] = useState<Src | null>(null)
  const [hint, setHint] = useState<{ text: string; from: Src; to: Dst } | null>(null)
  const [note, setNote] = useState('')
  const [finishing, setFinishing] = useState(false)
  const won = isWon(g)
  const { seconds, reset: resetClock } = useGameClock(!won)

  const act = (next: FreeCell) => { game.commit(next); setSel(null); setHint(null); setNote('') }
  const newDeal = (lv = level, number?: number) => { leaveChat(); game.restart(deal(lv, number ?? randomDeal())); setSel(null); setHint(null); setNote(''); setFinishing(false); resetClock() }

  useEffect(() => {
    if (!finishing) return
    return startVisibleInterval(() => {
      const step = autoStep(g)
      if (!step) { setFinishing(false); return }
      game.commit(move(g, step.from, step.to))
    }, 110)
  }, [finishing, g, game])

  const tryMove = (from: Src, to: Dst): boolean => {
    if (!canMove(g, from, to)) {
      if (to.kind === 'column') {
        const run = cardsOf(g, from)
        const room = maxMovable(g, g.columns[to.col].length === 0)
        if (run.length > room) setNote(t('fc.tooMany', { n: room }))
        else setNote(t('fc.cannot'))
      } else setNote(t('fc.cannot'))
      return false
    }
    act(move(g, from, to))
    return true
  }
  const tapSource = (s: Src, dropOn?: Dst) => {
    if (won || finishing) return
    if (sel && !same(sel, s) && dropOn) { if (canMove(g, sel, dropOn)) { act(move(g, sel, dropOn)); return } }
    if (same(sel, s)) {
      const d = bestDest(g, s)
      if (d) tryMove(s, d)
      else { setSel(null); setNote(t('fc.nowhere')) }
      return
    }
    if (!isRun(cardsOf(g, s))) { setNote(t('fc.notRun')); setSel(null); return }
    setSel(s)
    setHint(null)
    setNote('')
  }
  const tapDest = (d: Dst) => {
    if (won || finishing || !sel) return
    tryMove(sel, d)
  }

  const showHint = () => {
    const h = findHint(g, 40000)
    setSel(null)
    if (!h) { setNote(t('fc.hint.none')); return }
    const c = cardsOf(g, h.step.from)[0]
    const text = h.step.to.kind === 'foundation' ? t('fc.hint.home', { card: cardName(c) }) : h.step.to.kind === 'cell' ? t('fc.hint.cell', { card: cardName(c) }) : t('fc.hint.column', { card: cardName(c), col: h.step.to.col + 1 })
    setHint({ text: `${text} ${t(h.solved ? 'fc.hint.sure' : 'fc.hint.try')}`, from: h.step.from, to: h.step.to })
  }

  const cells = CELLS_OF[level]
  const hintFrom = hint?.from
  return (
    <div className="page">
      <div className="cg">
        <LevelBar name="freecell-level" legend={t('sudoku.level.label')} levels={FREECELL_LEVELS.map((l) => ({ id: l, label: `${t(LEVEL_KEYS[l])} ${CELLS_OF[l]}` }))} level={level} onLevel={(l) => { setLevel(l); newDeal(l) }}>
          <Button variant="secondary" onClick={() => newDeal()}>{t('fc.new')}</Button>
        </LevelBar>

        <DealBar number={g.dealNumber} max={DEAL_COUNT} canReplay={game.moves > 0} onGo={(n) => newDeal(level, n === UNSOLVABLE_DEAL ? n + 1 : n)} />
        {fromChat && <IncomingNote mode={fromChat} onFresh={() => newDeal()} />}
        <CardTable cols={8} fresh={game.moves === 0}>
          <p className="pc-hud">
            <GameClock seconds={seconds} label={t('sudoku.time')} />
            <span>{t('cd.moves', { n: game.moves })}</span>
          </p>
          <div className="pc-row">
            {g.cells.map((c, i) => {
              const s: Src = { kind: 'cell', cell: i }
              return <Single key={i} card={c} label={t('fc.cell', { n: i + 1 })} emptyLabel={t('fc.cell.empty', { n: i + 1 })} selected={same(sel, s)} hint={same(hintFrom ?? null, s) || (hint?.to.kind === 'cell' && hint.to.cell === i && !c)}
                onTap={() => { if (c) tapSource(s); else tapDest({ kind: 'cell', cell: i }) }} />
            })}
            {Array.from({ length: 4 - cells }, (_, i) => <span key={`gap${i}`} />)}
            {g.foundations.map((p, suit) => {
              const top = p[p.length - 1] ?? null
              return <Single key={suit} card={top} label={t('fc.foundation', { suit: t(`cd.suit.${SUIT_NAMES[suit]}` as StringKey) })} emptyLabel={t('fc.foundation.empty', { suit: t(`cd.suit.${SUIT_NAMES[suit]}` as StringKey) })}
                empty={<span style={{ color: suit === 1 || suit === 2 ? '#ff9a8f' : undefined }} aria-hidden="true">{GLYPH[suit]}</span>} hint={hint?.to.kind === 'foundation' && !!cardsOf(g, hint.from)[0] && cardsOf(g, hint.from)[0].suit === suit}
                onTap={() => tapDest({ kind: 'foundation' })} />
            })}
          </div>
          <div className="pc-row">
            {g.columns.map((col, ci) => {
              const cards: StackCard[] = col.map((c, k) => ({
                card: c,
                selected: !!sel && sel.kind === 'column' && sel.col === ci && k >= sel.index,
                hint: !!hintFrom && hintFrom.kind === 'column' && hintFrom.col === ci && k >= hintFrom.index,
              }))
              return (
                <Stack key={ci} cards={cards} label={t('fc.column', { n: ci + 1 })} emptyLabel={t('fc.column.empty', { n: ci + 1 })} maxHeight={9.4} k0={ci * 7}
                  hintEmpty={hint?.to.kind === 'column' && hint.to.col === ci && col.length === 0}
                  onEmpty={() => tapDest({ kind: 'column', col: ci })}
                  onTap={(i) => tapSource({ kind: 'column', col: ci, index: i }, { kind: 'column', col: ci })} />
              )
            })}
          </div>
        </CardTable>

        <p className="cg-note" role="status" aria-live="polite">{note || (sel ? t('fc.pick') : level === 'classic' ? t('fc.start') : t('fc.start.hard'))}</p>
        {hint && <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}><Button variant="secondary" onClick={() => tryMove(hint.from, hint.to)}>{t('kl.hint.do')}</Button></HintBox>}

        {won && (
          <SolvedCard title={t('fc.won')}>
            <p>{t('fc.wonBody', { n: g.dealNumber, time: clock(seconds), moves: game.moves })}</p>
            <div className="button-row"><Button onClick={() => newDeal()}>{t('fc.new')}</Button></div>
          </SolvedCard>
        )}

        <div className="cg-tools" style={{ '--tools': canAutoFinish(g) ? 3 : 2 } as React.CSSProperties}>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); setSel(null); setHint(null) }} disabled={!game.canUndo || finishing}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <GameShare shared={seededShare('freecell', level, g.dealNumber)} title={t('gx.game.freecell.title')} done={won} seconds={seconds} />
          <button type="button" className="sd-tool" onClick={showHint} disabled={won || finishing}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
          {canAutoFinish(g) && <button type="button" className="sd-tool" onClick={() => setFinishing(true)} disabled={finishing}><span>{t('cd.finish')}</span></button>}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('fc.help.1')}</p>
          <p>{t('fc.help.2')}</p>
          <p>{t('fc.help.3')}</p>
        </GameHelp>
        <CardCredits />
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
