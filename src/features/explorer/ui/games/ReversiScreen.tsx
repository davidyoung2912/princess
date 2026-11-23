import { useState } from 'react'
import { N, chooseMove, counts, flipsFor, isOver, legalMoves, play, start, winner, type Reversi } from '../../../games/domain/reversi'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t } from '../../../../shared/i18n'
import { OPENINGS, useComputerTurn, useHint, usePref, useRoving, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

/** Reversi against the computer: you are black and move first. Legal moves are shown as dots; the computer's last move and the discs it flipped are marked. */
export function ReversiScreen() {
  const [skill, setSkill] = usePref<Skill>('reversi', 'skill', SKILL_LIST, 'captain')
  const [opening, setOpening] = usePref<Opening>('reversi', 'opening', OPENINGS, 'you')
  const hint = useHint<Reversi, number>()
  const [started, setStarted] = useState(false)
  const game = useCardGame<Reversi>(start)
  const g = game.state
  const [flipped, setFlipped] = useState<number[]>([])
  const over = isOver(g)
  const mine = !over && g.turn === 1
  const legal = mine ? legalMoves(g.board, 1) : []
  const c = counts(g.board)

  const apply = (i: number) => { const r = play(g, i); if (r) { game.commit(r.game); setFlipped(r.flipped) } }
  const pick = (i: number) => { if (mine && legal.includes(i)) apply(i) }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m !== null) apply(m) })
  const { root, props } = useRoving(N, 64, pick)
  const reset = () => { game.restart(opening === 'you' ? start() : { ...start(), turn: 2 }); setFlipped([]); hint.reset() }
  const w = winner(g)

  return (
    <VsShell
      game="reversi" name="reversi" opening={opening} onOpening={setOpening} skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      status={g.passed ? t(g.passed === 1 ? 'rv.pass.you' : 'rv.pass.cpu') : t(mine ? 'bd.yourTurn' : 'bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(w === 1 ? 'bd.win' : w === 2 ? 'bd.lose' : 'bd.draw'), body: t('rv.final', { a: c.black, b: c.white }), outcome: w === 1 ? 'win' : w === 2 ? 'loss' : 'draw' } : null}
      meta={<><span>{t('rv.black', { n: c.black })}</span><span>{t('rv.white', { n: c.white })}</span></>}
      hint={{ run: () => { const m = chooseMove(g, 'captain'); if (m !== null) hint.give(g, m) }, shown: hint.of(g) !== null, used: hint.used }}
      undo={{ can: game.canUndo, run: () => { game.undoUntil((s) => s.turn === 1 && !isOver(s)); setFlipped([]) } }}
      help={<><p>{t('rv.help.1')}</p><p>{t('rv.help.2')}</p></>}
    >
      <svg ref={root} className="bd-board bd-board--reversi" viewBox="0 0 8 8" role="group" aria-label={t('rv.aria', { a: c.black, b: c.white })}>
        <rect className="bd-felt" x={0} y={0} width={8} height={8} rx={0.15} />
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8, y = Math.floor(i / 8), d = g.board[i]
          const can = legal.includes(i)
          return (
            <g key={i} {...props(i)} onClick={() => pick(i)} className="bd-hit" aria-label={t(d === 1 ? 'rv.cell.black' : d === 2 ? 'rv.cell.white' : can ? 'rv.cell.legal' : 'rv.cell.empty', { r: y + 1, c: x + 1, n: can ? flipsFor(g.board, i, 1).length : 0 })}>
              <rect className="bd-sq" x={x} y={y} width={1} height={1} />
              {d !== 0 && <circle className={`bd-disc bd-disc--${d === 1 ? 'b' : 'w'} ${flipped.includes(i) ? 'bd-disc--flip' : ''} ${g.last === i ? 'bd-disc--last' : ''}`} cx={x + 0.5} cy={y + 0.5} r={0.4} />}
              {hint.of(g) === i && <rect className="bd-hintring" x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} rx={0.1} />}
              {can && <circle className="bd-dot" cx={x + 0.5} cy={y + 0.5} r={0.11} />}
            </g>
          )
        })}
      </svg>
    </VsShell>
  )
}
