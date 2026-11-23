import { useState, type CSSProperties } from 'react'
import { RotateCcw } from 'lucide-react'
import { PYRAMID_LEVELS, canDraw, canRemove, cardOf, deal, draw, hint as findHint, isFree, isStuck, isWon, placeOf, remove, rowOf, rowStart, type Pick, type Pyramid, type PyramidLevel } from '../../../games/domain/pyramid'
import { clock } from '../../../games/domain/sudoku'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { CardCredits, CardTable, CardView, Single } from './cards/CardParts'
import { cardName } from './cards/cardArt'
import { CARD_RATIO } from './cards/cardArt'
import { useCardGame } from './cards/useCardGame'
import { DealBar } from './cards/DealBar'
import { MAX_DEAL, randomDealNumber } from './cards/dealNumber'
import { seededRng } from '../../../games/domain/cards'
import { GameClock, GameHelp, HintBox, LevelBar, SolvedCard, GameShare, IncomingNote } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'
import { seededShare } from '../../../games/domain/share'

const LEVEL_KEYS: Record<PyramidLevel, StringKey> = { easy: 'py.level.easy', classic: 'py.level.classic', hard: 'py.level.hard' }
const ROW_STEP = 0.55 // how far each row sits below the one above, in card widths
const samePick = (a: Pick | null, b: Pick): boolean => !!a && a.kind === b.kind && (a.kind === 'waste' || (b.kind === 'pyramid' && a.index === b.index))

/** Pyramid: remove Kings, and pairs of uncovered cards that add up to 13. Nothing is stored. */
export function PyramidScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('pyramid')
  const sent = incoming && incoming.shared.game === 'pyramid' ? incoming.shared.puzzle : null
  const [level, setLevel] = useState<PyramidLevel>((sent?.level as PyramidLevel) ?? 'classic')
  const [dealNo, setDealNo] = useState(() => sent?.seed ?? randomDealNumber())
  const game = useCardGame<Pyramid>(() => deal(level, seededRng(dealNo)))
  const g = game.state
  const [sel, setSel] = useState<Pick | null>(null)
  const [hint, setHint] = useState<{ text: string; picks: Pick[] } | null>(null)
  const [note, setNote] = useState('')
  const won = isWon(g)
  const stuck = isStuck(g)
  const { seconds, reset: resetClock } = useGameClock(!won)

  const act = (next: Pyramid) => { game.commit(next); setSel(null); setHint(null); setNote('') }
  const newDeal = (lv = level, no?: number) => { leaveChat(); const n = no ?? randomDealNumber(); setDealNo(n); game.restart(deal(lv, seededRng(n))); setSel(null); setHint(null); setNote(''); resetClock() }

  const tap = (p: Pick) => {
    if (won) return
    if (cardOf(g, p) === null) { setNote(t('py.covered')); return }
    if (canRemove(g, [p])) { act(remove(g, [p])); return }
    if (!sel) { setSel(p); setHint(null); setNote(''); return }
    if (samePick(sel, p)) { setSel(null); return }
    if (canRemove(g, [sel, p])) { act(remove(g, [sel, p])); return }
    const a = cardOf(g, sel)
    const b = cardOf(g, p)
    if (a && b) setNote(t('py.notPair', { sum: a.rank + b.rank }))
    setSel(p)
  }
  const stock = () => {
    if (won || !canDraw(g)) return
    act(draw(g))
  }
  const showHint = () => {
    const h = findHint(g)
    setSel(null)
    if (h) {
      const names = h.map((p) => cardName(cardOf(g, p)!))
      setHint({ text: h.length === 1 ? t('py.hint.king', { card: names[0] }) : t('py.hint.pair', { a: names[0], b: names[1] }), picks: h })
    } else setHint({ text: canDraw(g) ? t('py.hint.draw') : t('py.hint.none'), picks: [] })
  }

  const hinted = (p: Pick) => !!hint?.picks.some((h) => samePick(h, p))
  const topWaste = g.waste[g.waste.length - 1] ?? null
  const height = ROW_STEP * 6 + CARD_RATIO
  // Each card sits half a card-and-gap to the side of the row above, so a card rests on the two below it.
  const slot = 'calc(var(--cw) + var(--gap))'

  return (
    <div className="page">
      <div className="cg">
        <LevelBar name="pyramid-level" legend={t('sudoku.level.label')} levels={PYRAMID_LEVELS.map((l) => ({ id: l, label: t(LEVEL_KEYS[l]) }))} level={level} onLevel={(l) => { setLevel(l); newDeal(l) }}>
          <Button variant="secondary" onClick={() => newDeal()}>{t('py.new')}</Button>
        </LevelBar>
        <DealBar number={dealNo} max={MAX_DEAL} canReplay={game.moves > 0} onGo={(n) => newDeal(level, n)} />
        {fromChat && <IncomingNote mode={fromChat} onFresh={() => newDeal()} />}

        <CardTable cols={7} fresh={game.moves === 0}>
          <p className="pc-hud">
            <GameClock seconds={seconds} label={t('sudoku.time')} />
            <span>{t('cd.moves', { n: game.moves })}</span>
            <span>{t('py.left', { n: g.tableau.filter(Boolean).length })}</span>
          </p>
          <div className="py-pyramid" role="group" aria-label={t('py.pyramid')} style={{ height: `calc(var(--cw) * ${height})` } as CSSProperties}>
            {g.tableau.map((card, i) => {
              if (!card) return null
              const r = rowOf(i)
              const place = placeOf(i)
              const free = isFree(g, i)
              const p: Pick = { kind: 'pyramid', index: i }
              const style = {
                left: `calc(50% - (var(--cw) + var(--gap)) * ${(r + 1) / 2} + var(--gap) / 2 + ${slot} * ${place})`,
                top: `calc(var(--cw) * ${ROW_STEP * r})`,
                height: free ? undefined : `calc(var(--cw) * ${ROW_STEP})`,
                zIndex: r + 1,
                '--k': rowStart(r) + place,
              } as CSSProperties
              const cls = ['pc', 'pc--up', free ? '' : 'pc--strip pc--covered', samePick(sel, p) ? 'pc--sel' : '', hinted(p) ? 'pc--hint' : ''].join(' ')
              return (
                <button key={card.id} type="button" className={cls} style={style} aria-label={`${cardName(card)}${free ? '' : `, ${t('py.coveredBy')}`}`} aria-disabled={!free} aria-pressed={samePick(sel, p) || undefined} onClick={() => tap(p)}>
                  <CardView card={card} edge={!free} />
                </button>
              )
            })}
          </div>
          <div className="py-hand">
            <Single back card={null} label={t('py.stock')} emptyLabel={t('py.stock.empty')} count={g.stock.length} onTap={stock} hint={hint?.picks.length === 0 && g.stock.length > 0} />
            <Single card={topWaste} label={t('py.waste')} emptyLabel={t('py.waste.empty')} empty={<RotateCcw aria-hidden="true" focusable="false" />} selected={samePick(sel, { kind: 'waste' })} hint={hinted({ kind: 'waste' })}
              onTap={() => (topWaste ? tap({ kind: 'waste' }) : stock())} />
            <p className="py-pass" aria-live="polite">{t('py.pass', { n: g.pass, of: g.passes })}</p>
          </div>
        </CardTable>

        <p className="cg-note" role="status" aria-live="polite">{note || (stuck ? t('py.stuck') : sel ? t('py.pick') : t('py.start'))}</p>
        {hint && <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}>{hint.picks.length > 0 && <Button variant="secondary" onClick={() => act(remove(g, hint.picks))}>{t('kl.hint.do')}</Button>}</HintBox>}

        {won && (
          <SolvedCard title={t('py.won')}>
            <p>{t('py.wonBody', { time: clock(seconds), n: game.moves })}</p>
            <div className="button-row"><Button onClick={() => newDeal()}>{t('py.new')}</Button></div>
          </SolvedCard>
        )}
        {stuck && !won && (
          <SolvedCard title={t('py.over')}>
            <p>{t('py.overBody', { n: g.tableau.filter(Boolean).length })}</p>
            <div className="button-row"><Button onClick={() => newDeal()}>{t('py.new')}</Button></div>
          </SolvedCard>
        )}

        <div className="cg-tools" style={{ '--tools': 2 } as CSSProperties}>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); setSel(null); setHint(null) }} disabled={!game.canUndo}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <GameShare shared={seededShare('pyramid', level, dealNo)} title={t('gx.game.pyramid.title')} done={won} seconds={seconds} />
          <button type="button" className="sd-tool" onClick={showHint} disabled={won}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('py.help.1')}</p>
          <p>{t('py.help.2')}</p>
          <p>{t('py.help.3')}</p>
        </GameHelp>
        <CardCredits />
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
