import { useState } from 'react'
import { COLS, ROWS, chooseMove, drop, legalMoves, start, type C4 } from '../../../games/domain/connect4'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t } from '../../../../shared/i18n'
import { OPENINGS, useComputerTurn, useHint, usePref, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

/** Connect Four against the computer: you are red and drop first. Tap a column to drop a disc; four in a line wins. */
export function Connect4Screen() {
  const [skill, setSkill] = usePref<Skill>('connect4', 'skill', SKILL_LIST, 'captain')
  const [opening, setOpening] = usePref<Opening>('connect4', 'opening', OPENINGS, 'you')
  const [started, setStarted] = useState(false)
  const game = useCardGame<C4>(start)
  const g = game.state
  const hint = useHint<C4, number>()
  const over = g.winner !== 0
  const mine = !over && g.turn === 1
  const legal = legalMoves(g)

  const play = (col: number) => { const next = drop(g, col); if (next) game.commit(next) }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m !== null) play(m) })
  const reset = () => { game.restart(opening === 'you' ? start() : { ...start(), turn: 2 }); hint.reset() }
  const h = hint.of(g)

  return (
    <VsShell
      game="connect4" name="connect4" skill={skill} onSkill={setSkill} opening={opening} onOpening={setOpening} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      status={t(mine ? 'bd.yourTurn' : 'bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(g.winner === 1 ? 'bd.win' : g.winner === 2 ? 'bd.lose' : 'bd.draw'), body: t('c4.final', { n: g.moves }), outcome: g.winner === 1 ? 'win' : g.winner === 2 ? 'loss' : 'draw' } : null}
      meta={<span>{t('gm.moves', { n: g.moves })}</span>}
      undo={{ can: game.canUndo, run: () => { game.undoUntil((s) => s.turn === 1 && s.winner === 0); hint.reset() } }}
      hint={{ run: () => { const m = chooseMove(g, 'captain'); if (m !== null) hint.give(g, m) }, shown: h !== null, used: hint.used }}
      help={<><p>{t('c4.help.1')}</p><p>{t('c4.help.2')}</p></>}
    >
      <div className="bd-c4" role="group" aria-label={t('c4.aria')}>
        <div className="bd-c4__cols">
          {Array.from({ length: COLS }, (_, c) => (
            <button key={c} type="button" className={`bd-c4__col ${h === c ? 'bd-c4__col--hint' : ''}`} disabled={!mine || !legal.includes(c)} onClick={() => play(c)} aria-label={t('c4.col', { n: c + 1 })}><span aria-hidden="true">▼</span></button>
          ))}
        </div>
        <svg className="bd-board bd-board--c4" viewBox={`0 0 ${COLS} ${ROWS}`} role="img" aria-label={t('c4.board', { n: g.moves })}>
          <rect className="bd-c4__frame" x={0} y={0} width={COLS} height={ROWS} rx={0.25} />
          {g.cells.map((p, i) => {
            const x = i % COLS, y = Math.floor(i / COLS)
            return <circle key={i} className={`bd-c4__slot ${p === 1 ? 'bd-c4__slot--r' : p === 2 ? 'bd-c4__slot--y' : ''} ${g.line.includes(i) ? 'bd-c4__slot--win' : ''} ${g.last === i ? 'bd-c4__slot--last' : ''}`} cx={x + 0.5} cy={y + 0.5} r={0.4} />
          })}
        </svg>
      </div>
    </VsShell>
  )
}
