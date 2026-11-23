import { useState, type CSSProperties } from 'react'
import { TRI_LEVELS, canDraw, canPlay, deal, draw, hint as findHint, isFree, isStuck, isWon, play, rowOf, wasteTop, xOf, type TriLevel, type TriPeaks } from '../../../games/domain/tripeaks'
import { clock } from '../../../games/domain/sudoku'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { CardBack, CardCredits, CardTable, CardView, Single } from './cards/CardParts'
import { CARD_RATIO, cardName } from './cards/cardArt'
import { useCardGame } from './cards/useCardGame'
import { DealBar } from './cards/DealBar'
import { MAX_DEAL, randomDealNumber } from './cards/dealNumber'
import { seededRng } from '../../../games/domain/cards'
import { GameClock, GameHelp, HintBox, LevelBar, SolvedCard } from './parts'
import { useGameClock } from './gameHooks'

const LEVEL_KEYS: Record<TriLevel, StringKey> = { easy: 'tp.level.easy', classic: 'tp.level.classic' }
const ROW_STEP = 0.62 // how far each row sits below the one above, in card widths

/** TriPeaks: clear three peaks by taking cards one rank above or below the waste card. Nothing is stored. */
export function TriPeaksScreen() {
  const [level, setLevel] = useState<TriLevel>('classic')
  const [dealNo, setDealNo] = useState(randomDealNumber)
  const game = useCardGame<TriPeaks>(() => deal('classic', seededRng(dealNo)))
  const g = game.state
  const [hint, setHint] = useState<{ text: string; card: number | null } | null>(null)
  const [note, setNote] = useState('')
  const won = isWon(g)
  const stuck = isStuck(g)
  const { seconds, reset: resetClock } = useGameClock(!won && !stuck)

  const act = (next: TriPeaks) => { game.commit(next); setHint(null); setNote('') }
  const newDeal = (lv = level, no?: number) => { const n = no ?? randomDealNumber(); setDealNo(n); game.restart(deal(lv, seededRng(n))); setHint(null); setNote(''); resetClock() }

  const tap = (i: number) => {
    if (won || stuck) return
    if (!isFree(g, i)) return
    if (canPlay(g, i)) act(play(g, i))
    else setNote(t('tp.nofit', { card: cardName(wasteTop(g)), wrap: g.wrap ? t('tp.wrap') : '' }))
  }
  const stock = () => { if (!won && canDraw(g)) act(draw(g)) }
  const showHint = () => {
    const h = findHint(g)
    if (h === null) setHint({ text: canDraw(g) ? t('tp.hint.draw') : t('tp.hint.none'), card: null })
    else setHint({ text: t('tp.hint.play', { card: cardName(g.tableau[h]!), top: cardName(wasteTop(g)) }), card: h })
  }

  const height = ROW_STEP * 3 + CARD_RATIO
  const slot = 'calc(var(--cw) + var(--gap))'
  const left = remaining(g)

  return (
    <div className="page">
      <div className="cg">
        <LevelBar name="tripeaks-level" legend={t('sudoku.level.label')} levels={TRI_LEVELS.map((l) => ({ id: l, label: t(LEVEL_KEYS[l]) }))} level={level} onLevel={(l) => { setLevel(l); newDeal(l) }}>
          <Button variant="secondary" onClick={() => newDeal()}>{t('tp.new')}</Button>
        </LevelBar>
        <DealBar number={dealNo} max={MAX_DEAL} canReplay={game.moves > 0} onGo={(n) => newDeal(level, n)} />

        <CardTable cols={10} fresh={game.moves === 0}>
          <p className="pc-hud">
            <GameClock seconds={seconds} label={t('sudoku.time')} />
            <span>{t('tp.score', { n: g.score })}</span>
            <span>{t('tp.streak', { n: g.streak })}</span>
          </p>
          <div className="tp-board" role="group" aria-label={t('tp.peaks')} style={{ height: `calc(var(--cw) * ${height})` } as CSSProperties}>
            {g.tableau.map((card, i) => {
              if (!card) return null
              const r = rowOf(i)
              const free = isFree(g, i)
              const style = {
                left: `calc(${slot} * ${xOf(i) / 2})`,
                top: `calc(var(--cw) * ${ROW_STEP * r})`,
                zIndex: r + 1,
                '--k': i,
              } as CSSProperties
              if (!free) return <CardBack key={card.id} style={{ ...style, height: `calc(var(--cw) * ${ROW_STEP})` }} />
              const cls = ['pc', 'pc--up', hint?.card === i ? 'pc--hint' : '', canPlay(g, i) ? 'pc--ok' : ''].join(' ')
              return (
                <button key={card.id} type="button" className={cls} style={style} aria-label={cardName(card)} onClick={() => tap(i)}>
                  <CardView card={card} />
                </button>
              )
            })}
          </div>
          <div className="tp-hand">
            <Single back card={null} label={t('tp.stock')} emptyLabel={t('tp.stock.empty')} count={g.stock.length} onTap={stock} hint={!!hint && hint.card === null && g.stock.length > 0} />
            <Single card={wasteTop(g)} label={t('tp.waste')} emptyLabel={t('tp.waste')} />
          </div>
        </CardTable>

        <p className="cg-note" role="status" aria-live="polite">{note || t(g.wrap ? 'tp.start.easy' : 'tp.start', { n: left })}</p>
        {hint && <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}>{hint.card !== null && <Button variant="secondary" onClick={() => tap(hint.card!)}>{t('kl.hint.do')}</Button>}</HintBox>}

        {won && (
          <SolvedCard title={t('tp.won')}>
            <p>{t('tp.wonBody', { score: g.score, time: clock(seconds), left: g.stock.length })}</p>
            <div className="button-row"><Button onClick={() => newDeal()}>{t('tp.new')}</Button></div>
          </SolvedCard>
        )}
        {stuck && (
          <SolvedCard title={t('tp.over')}>
            <p>{t('tp.overBody', { n: left, score: g.score })}</p>
            <div className="button-row"><Button onClick={() => newDeal()}>{t('tp.new')}</Button></div>
          </SolvedCard>
        )}

        <div className="cg-tools" style={{ '--tools': 2 } as CSSProperties}>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); setHint(null) }} disabled={!game.canUndo}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <button type="button" className="sd-tool" onClick={showHint} disabled={won || stuck}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('tp.help.1')}</p>
          <p>{t('tp.help.2')}</p>
          <p>{t('tp.help.3')}</p>
        </GameHelp>
        <CardCredits />
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}

const remaining = (g: TriPeaks): number => g.tableau.filter(Boolean).length
