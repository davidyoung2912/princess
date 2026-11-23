import { useState } from 'react'
import { SPIDER_LEVELS, bestDest, canDeal, canMove, canPick, deal, dealRow, hint as findHint, isWon, move, type Spider, type SpiderLevel } from '../../../games/domain/spider'
import { clock } from '../../../games/domain/sudoku'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { CardCredits, CardTable, Single, Stack, type StackCard } from './cards/CardParts'
import { cardName } from './cards/cardArt'
import { useCardGame } from './cards/useCardGame'
import { DealBar } from './cards/DealBar'
import { MAX_DEAL, randomDealNumber } from './cards/dealNumber'
import { seededRng } from '../../../games/domain/cards'
import { GameClock, GameHelp, HintBox, LevelBar, SolvedCard, GameShare, IncomingNote } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'
import { seededShare } from '../../../games/domain/share'

const LEVEL_KEYS: Record<SpiderLevel, StringKey> = { one: 'sp.level.one', two: 'sp.level.two', four: 'sp.level.four' }
interface Sel { col: number; index: number }
interface Shown { text: string; from?: Sel; to?: number; deal?: boolean }

/** Spider: build down in any suit, but only a run of one suit moves together; a complete King to Ace run of one suit leaves the table. Nothing is stored. */
export function SpiderScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('spider')
  const sent = incoming && incoming.shared.game === 'spider' ? incoming.shared.puzzle : null
  const [level, setLevel] = useState<SpiderLevel>((sent?.level as SpiderLevel) ?? 'one')
  const [dealNo, setDealNo] = useState(() => sent?.seed ?? randomDealNumber())
  const game = useCardGame<Spider>(() => deal(level, seededRng(dealNo)))
  const g = game.state
  const [sel, setSel] = useState<Sel | null>(null)
  const [hint, setHint] = useState<Shown | null>(null)
  const [note, setNote] = useState('')
  const won = isWon(g)
  const { seconds, reset: resetClock } = useGameClock(!won)

  const act = (next: Spider) => { game.commit(next); setSel(null); setHint(null); setNote('') }
  const newDeal = (lv = level, no?: number) => { leaveChat(); const n = no ?? randomDealNumber(); setDealNo(n); game.restart(deal(lv, seededRng(n))); setSel(null); setHint(null); setNote(''); resetClock() }

  const tryMove = (from: Sel, to: number): boolean => {
    if (!canMove(g, from.col, from.index, to)) return false
    act(move(g, from.col, from.index, to))
    return true
  }
  const tapCard = (col: number, index: number) => {
    if (won) return
    if (sel && sel.col !== col && tryMove(sel, col)) return
    if (!canPick(g, col, index)) { setNote(t('sp.notRun')); setSel(null); return }
    if (sel && sel.col === col && sel.index === index) {
      const to = bestDest(g, col, index)
      if (to !== null) tryMove(sel, to)
      else { setSel(null); setNote(t('sp.nowhere')) }
      return
    }
    setSel({ col, index })
    setHint(null)
    setNote('')
  }
  const tapEmpty = (col: number) => {
    if (won || !sel) return
    if (!tryMove(sel, col)) setNote(t('sp.cannot'))
  }
  const dealMore = () => {
    if (won) return
    if (g.stock.length === 0) return
    if (!canDeal(g)) { setNote(t('sp.fillFirst')); return }
    act(dealRow(g))
  }

  const showHint = () => {
    const h = findHint(g)
    setSel(null)
    if (!h) { setHint({ text: t('sp.hint.none') }); return }
    if (h === 'deal') { setHint({ text: t('sp.hint.deal'), deal: true }); return }
    const c = g.columns[h.from].up[h.index]
    setHint({ text: t('sp.hint.move', { card: cardName(c), col: h.to + 1 }), from: { col: h.from, index: h.index }, to: h.to })
  }
  const doHint = () => {
    if (!hint) return
    if (hint.deal) dealMore()
    else if (hint.from && hint.to !== undefined) tryMove(hint.from, hint.to)
  }

  const rowsLeft = Math.floor(g.stock.length / 10)

  return (
    <div className="page">
      <div className="cg">
        <LevelBar name="spider-level" legend={t('sudoku.level.label')} levels={SPIDER_LEVELS.map((l) => ({ id: l, label: t(LEVEL_KEYS[l]) }))} level={level} onLevel={(l) => { setLevel(l); newDeal(l) }}>
          <Button variant="secondary" onClick={() => newDeal()}>{t('sp.new')}</Button>
        </LevelBar>
        <DealBar number={dealNo} max={MAX_DEAL} canReplay={game.moves > 0} onGo={(n) => newDeal(level, n)} />
        {fromChat && <IncomingNote mode={fromChat} onFresh={() => newDeal()} />}

        <CardTable cols={10} fresh={game.moves === 0}>
          <p className="pc-hud">
            <GameClock seconds={seconds} label={t('sudoku.time')} />
            <span>{t('cd.moves', { n: game.moves })}</span>
            <span>{t('sp.done', { n: g.done.length })}</span>
          </p>
          <div className="pc-row" style={{ marginBottom: 'calc(var(--cw) * 0.3)' }}>
            <Single back card={null} label={t('sp.stock')} emptyLabel={t('sp.stock.empty')} count={rowsLeft} onTap={dealMore} hint={!!hint?.deal} />
            <span style={{ gridColumn: 'span 1' }} />
            <div className="cg-done" role="img" aria-label={t('sp.done', { n: g.done.length })} style={{ gridColumn: '3 / span 8', justifySelf: 'end' }}>
              {Array.from({ length: 8 }, (_, i) => <span key={i} className={`cg-done__pip ${i < g.done.length ? 'cg-done__pip--on' : ''}`} />)}
            </div>
          </div>
          <div className="pc-row">
            {g.columns.map((col, ci) => {
              const cards: StackCard[] = [
                ...col.down.map((c) => ({ card: c, down: true })),
                ...col.up.map((c, k) => ({
                  card: c,
                  selected: !!sel && sel.col === ci && k >= sel.index,
                  hint: !!hint?.from && hint.from.col === ci && k >= hint.from.index,
                })),
              ]
              return (
                <Stack key={ci} cards={cards} label={t('sp.column', { n: ci + 1 })} emptyLabel={t('sp.column.empty', { n: ci + 1 })} maxHeight={9.6} k0={ci * 6}
                  hintEmpty={hint?.to === ci && col.up.length === 0}
                  onEmpty={() => tapEmpty(ci)}
                  onTap={(i) => { const k = i - col.down.length; if (k >= 0) tapCard(ci, k) }} />
              )
            })}
          </div>
        </CardTable>

        <p className="cg-note" role="status" aria-live="polite">{note || (sel ? t('sp.pick') : t('sp.start'))}</p>
        {hint && <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}>{(hint.from || hint.deal) && <Button variant="secondary" onClick={doHint}>{t('kl.hint.do')}</Button>}</HintBox>}

        {won && (
          <SolvedCard title={t('sp.won')}>
            <p>{t('sp.wonBody', { time: clock(seconds), n: game.moves })}</p>
            <div className="button-row"><Button onClick={() => newDeal()}>{t('sp.new')}</Button></div>
          </SolvedCard>
        )}

        <div className="cg-tools" style={{ '--tools': 2 } as React.CSSProperties}>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); setSel(null); setHint(null) }} disabled={!game.canUndo}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <GameShare shared={seededShare('spider', level, dealNo)} title={t('gx.game.spider.title')} done={won} seconds={seconds} />
          <button type="button" className="sd-tool" onClick={showHint} disabled={won}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('sp.help.1')}</p>
          <p>{t('sp.help.2')}</p>
          <p>{t('sp.help.3')}</p>
        </GameHelp>
        <CardCredits />
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
