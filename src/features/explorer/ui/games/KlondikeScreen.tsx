import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { KLONDIKE_LEVELS, autoStep, bestDest, canAutoFinish, canDraw, canMove, cardsAt, deal, drawFromStock, hint as findHint, isWon, move, type Dest, type Hint, type Klondike, type KlondikeLevel, type Source } from '../../../games/domain/klondike'
import { clock } from '../../../games/domain/sudoku'
import { startVisibleInterval } from '../../../../shared/hooks/visibleInterval'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { CardCredits, CardTable, CardView, Single, Stack, type StackCard } from './cards/CardParts'
import { cardName } from './cards/cardArt'
import { useCardGame } from './cards/useCardGame'
import { DealBar } from './cards/DealBar'
import { MAX_DEAL, randomDealNumber } from './cards/dealNumber'
import { seededRng } from '../../../games/domain/cards'
import { GameClock, GameHelp, HintBox, LevelBar, SolvedCard, GameShare, IncomingNote } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'
import { seededShare } from '../../../games/domain/share'

const LEVEL_KEYS: Record<KlondikeLevel, StringKey> = { draw1: 'kl.level.draw1', draw3: 'kl.level.draw3' }
const sameSource = (a: Source | null, b: Source): boolean => !!a && JSON.stringify(a) === JSON.stringify(b)

/** Klondike ("Solitaire"). Tap a card, then where it should go; tap it again to send it to its best place. Nothing is stored. */
export function KlondikeScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('klondike')
  const sent = incoming && incoming.shared.game === 'klondike' ? incoming.shared.puzzle : null
  const [level, setLevel] = useState<KlondikeLevel>((sent?.level as KlondikeLevel) ?? 'draw1')
  const [dealNo, setDealNo] = useState(() => sent?.seed ?? randomDealNumber())
  const game = useCardGame<Klondike>(() => deal(level, seededRng(dealNo)))
  const g = game.state
  const [sel, setSel] = useState<Source | null>(null)
  const [hint, setHint] = useState<{ text: string; h: Hint } | null>(null)
  const [note, setNote] = useState('')
  const [finishing, setFinishing] = useState(false)
  const won = isWon(g)
  const { seconds, reset: resetClock } = useGameClock(!won)

  const act = (next: Klondike) => { game.commit(next); setSel(null); setHint(null); setNote('') }
  const newDeal = (lv = level, no?: number) => { leaveChat(); const n = no ?? randomDealNumber(); setDealNo(n); game.restart(deal(lv, seededRng(n))); setSel(null); setHint(null); setNote(''); setFinishing(false); resetClock() }

  /* "Finish" moves every remaining card home, one at a time. */
  useEffect(() => {
    if (!finishing) return
    return startVisibleInterval(() => {
      const step = autoStep(g)
      if (!step) { setFinishing(false); return }
      game.commit(move(g, step.from, step.to))
    }, 110)
  }, [finishing, g, game])

  const tryMove = (from: Source, to: Dest): boolean => {
    if (!canMove(g, from, to)) return false
    act(move(g, from, to))
    return true
  }
  /** A tap on a card you could pick up: pick it up, move the held cards onto it, or (tapping the held card again) send it to its best place. */
  const tapSource = (s: Source, dropOn?: Dest) => {
    if (won || finishing) return
    if (sel && !sameSource(sel, s) && dropOn && tryMove(sel, dropOn)) return
    if (sameSource(sel, s)) {
      const d = bestDest(g, s)
      if (d) tryMove(s, d)
      else { setSel(null); setNote(t('kl.nowhere')) }
      return
    }
    setSel(s)
    setHint(null)
    setNote('')
  }
  const tapDest = (d: Dest) => {
    if (won || finishing || !sel) return
    if (!tryMove(sel, d)) setNote(t('kl.cannot'))
  }

  const stock = () => {
    if (won || finishing) return
    if (!canDraw(g)) return
    act(drawFromStock(g))
  }

  const showHint = () => {
    const h = findHint(g)
    if (!h) { setHint({ text: t('kl.hint.none'), h: { from: { kind: 'waste' }, to: 'draw' } }); return }
    setSel(null)
    const c = cardsAt(g, h.from)[0]
    let text: string
    if (h.to === 'draw') text = t(g.stock.length > 0 ? 'kl.hint.draw' : 'kl.hint.turn')
    else if (h.to.kind === 'foundation') text = t('kl.hint.home', { card: cardName(c) })
    else text = t('kl.hint.column', { card: cardName(c), col: h.to.col + 1 })
    setHint({ text, h })
  }
  const doHint = () => {
    if (!hint) return
    if (hint.h.to === 'draw') act(drawFromStock(g))
    else tryMove(hint.h.from, hint.h.to)
  }

  const hintFrom = hint?.h.from
  const hintTo = hint && hint.h.to !== 'draw' ? hint.h.to : null
  const isHintCard = (s: Source, ci?: number) => {
    if (!hintFrom) return false
    if (s.kind !== hintFrom.kind) return false
    if (s.kind === 'column' && hintFrom.kind === 'column') return s.col === hintFrom.col && ci !== undefined && ci >= hintFrom.index
    return true
  }

  const wasteShown = g.waste.slice(-(g.draw === 3 ? 3 : 1))

  return (
    <div className="page">
      <div className="cg">
        <LevelBar name="klondike-level" legend={t('sudoku.level.label')} levels={KLONDIKE_LEVELS.map((l) => ({ id: l, label: t(LEVEL_KEYS[l]) }))} level={level} onLevel={(l) => { setLevel(l); newDeal(l) }}>
          <Button variant="secondary" onClick={() => newDeal()}>{t('kl.new')}</Button>
        </LevelBar>
        <DealBar number={dealNo} max={MAX_DEAL} canReplay={game.moves > 0} onGo={(n) => newDeal(level, n)} />
        {fromChat && <IncomingNote mode={fromChat} onFresh={() => newDeal()} />}

        <CardTable cols={7} fresh={game.moves === 0}>
          <p className="pc-hud">
            <GameClock seconds={seconds} label={t('sudoku.time')} />
            <span>{t('cd.moves', { n: game.moves })}</span>
            <span>{t('kl.home', { n: g.foundations.reduce((a, p) => a + p.length, 0) })}</span>
          </p>
          <div className="pc-row">
            <Single back card={null} label={t('kl.stock')} emptyLabel={t('kl.stock.empty')} count={g.stock.length} onTap={stock} hint={hint?.h.to === 'draw' && g.stock.length > 0} />
            <div className="pc-pile pc-waste" role="group" aria-label={t('kl.waste')}>
              {wasteShown.length === 0 && <button type="button" className="pc-slot" aria-label={t('kl.waste.empty')} onClick={stock}><RotateCcw aria-hidden="true" focusable="false" /></button>}
              {wasteShown.map((c, i) => {
                const top = i === wasteShown.length - 1
                const style = { left: `calc(var(--cw) * ${i * 0.28})`, inset: undefined, top: 0 } as React.CSSProperties
                const source: Source = { kind: 'waste' }
                return top ? (
                  <button key={c.id} type="button" className={`pc pc--up pc-fan ${sameSource(sel, source) ? 'pc--sel' : ''} ${isHintCard(source) ? 'pc--hint' : ''}`} style={style} aria-label={`${t('kl.waste')}, ${cardName(c)}`} aria-pressed={sameSource(sel, source) || undefined} onClick={() => tapSource(source)}><CardView card={c} /></button>
                ) : (
                  <div key={c.id} className="pc pc--up pc-fan" style={style} aria-hidden="true"><CardView card={c} /></div>
                )
              })}
            </div>
            <span />
            {g.foundations.map((p, i) => {
              const top = p[p.length - 1] ?? null
              const source: Source = { kind: 'foundation', pile: i }
              return (
                <Single key={i} card={top} label={t('kl.foundation', { n: i + 1 })} emptyLabel={t('kl.foundation.empty', { n: i + 1 })} empty="A"
                  selected={sameSource(sel, source)} hint={hintTo?.kind === 'foundation' && hintTo.pile === i}
                  onTap={() => { if (sel && !sameSource(sel, source)) tapDest({ kind: 'foundation', pile: i }); else if (top) tapSource(source) }} />
              )
            })}
          </div>
          <div className="pc-row">
            {g.columns.map((col, ci) => {
              const cards: StackCard[] = [
                ...col.down.map((c) => ({ card: c, down: true })),
                ...col.up.map((c, k) => {
                  const s: Source = { kind: 'column', col: ci, index: k }
                  return { card: c, selected: !!sel && sel.kind === 'column' && sel.col === ci && k >= sel.index, hint: isHintCard(s, k) }
                }),
              ]
              return (
                <Stack key={ci} cards={cards} label={t('kl.column', { n: ci + 1 })} emptyLabel={t('kl.column.empty', { n: ci + 1 })} empty="K" maxHeight={8.2} k0={ci * 7}
                  hintEmpty={hintTo?.kind === 'column' && hintTo.col === ci && col.up.length === 0}
                  onEmpty={() => tapDest({ kind: 'column', col: ci })}
                  onTap={(i) => { const k = i - col.down.length; if (k >= 0) tapSource({ kind: 'column', col: ci, index: k }, { kind: 'column', col: ci }) }} />
              )
            })}
          </div>
        </CardTable>

        <p className="cg-note" role="status" aria-live="polite">{note || (sel ? t('kl.pick') : t('kl.start'))}</p>
        {hint && <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}>{hint.h.from && <Button variant="secondary" onClick={doHint}>{t('kl.hint.do')}</Button>}</HintBox>}

        {won && (
          <SolvedCard title={t('kl.won')}>
            <p>{t('kl.wonBody', { time: clock(seconds), n: game.moves })}</p>
            <div className="button-row"><Button onClick={() => newDeal()}>{t('kl.new')}</Button></div>
          </SolvedCard>
        )}

        <div className="cg-tools" style={{ '--tools': canAutoFinish(g) ? 3 : 2 } as React.CSSProperties}>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); setSel(null); setHint(null) }} disabled={!game.canUndo || finishing}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <GameShare shared={seededShare('klondike', level, dealNo)} title={t('gx.game.klondike.title')} done={won} seconds={seconds} />
          <button type="button" className="sd-tool" onClick={showHint} disabled={won || finishing}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
          {canAutoFinish(g) && <button type="button" className="sd-tool" onClick={() => setFinishing(true)} disabled={finishing}><span>{t('cd.finish')}</span></button>}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('kl.help.1')}</p>
          <p>{t('kl.help.2')}</p>
          <p>{t('kl.help.3')}</p>
        </GameHelp>
        <CardCredits />
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
