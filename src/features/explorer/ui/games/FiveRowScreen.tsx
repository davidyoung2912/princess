import { useState } from 'react'
import { chooseMove, place, start, SIZE_OF, type Five, type FiveMode } from '../../../games/domain/fiveRow'
import type { Skill } from '../../../games/domain/search'
import { t } from '../../../../shared/i18n'
import { useComputerTurn, useRoving } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

/** Gomoku (15 by 15) and Pente (19 by 19, with captures) share one board: you are black and move first. The stones sit on the line crossings, drawn in SVG. */
function FiveRow({ mode }: { mode: FiveMode }) {
  const n = SIZE_OF[mode]
  const [skill, setSkill] = useState<Skill>('captain')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Five>(() => start(mode))
  const g = game.state
  const over = g.winner !== 0
  const mine = !over && g.turn === 1
  const pick = (i: number) => { if (!mine) return; const next = place(g, i); if (next) game.commit(next) }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m !== null) { const next = place(g, m); if (next) game.commit(next) } })
  const { root, props } = useRoving(n, n * n, pick)
  const reset = () => game.restart(start(mode))
  const hoshi = mode === 'pente' ? [3, 9, 15] : [3, 7, 11]
  const star = (i: number) => hoshi.includes(i % n) && hoshi.includes(Math.floor(i / n))

  return (
    <VsShell
      name={mode} skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      status={t(mine ? 'bd.yourTurn' : 'bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(g.winner === 1 ? 'bd.win' : g.winner === 2 ? 'bd.lose' : 'bd.draw'), body: (mode === 'pente' ? t('pn.final', { n: g.moves }) : t('gm.final', { n: g.moves })) } : null}
      meta={mode === 'pente' ? <span>{t('pn.captures', { a: g.captures[0], b: g.captures[1] })}</span> : <span>{t('gm.moves', { n: g.moves })}</span>}
      undo={{ can: game.canUndo, run: () => game.undoUntil((s) => s.turn === 1 && s.winner === 0) }}
      help={<><p>{mode === 'pente' ? t('pn.help.1') : t('gm.help.1')}</p><p>{mode === 'pente' ? t('pn.help.2') : t('gm.help.2')}</p></>}
    >
      <svg ref={root} className="bd-board bd-board--five" viewBox={`0 0 ${n} ${n}`} role="group" aria-label={(mode === 'pente' ? t('pn.aria', { n }) : t('gm.aria', { n }))}>
        <rect className="bd-wood" x={0} y={0} width={n} height={n} rx={0.3} />
        {Array.from({ length: n }, (_, i) => <g key={i} className="bd-lines"><line x1={0.5} x2={n - 0.5} y1={i + 0.5} y2={i + 0.5} /><line y1={0.5} y2={n - 0.5} x1={i + 0.5} x2={i + 0.5} /></g>)}
        {Array.from({ length: n * n }, (_, i) => {
          const x = i % n, y = Math.floor(i / n), d = g.cells[i]
          return (
            <g key={i} {...props(i)} onClick={() => pick(i)} className="bd-hit" aria-label={t(d === 1 ? 'fr.cell.black' : d === 2 ? 'fr.cell.white' : 'fr.cell.empty', { r: y + 1, c: x + 1 })}>
              <rect className="bd-sq bd-sq--clear" x={x} y={y} width={1} height={1} />
              {d === 0 && star(i) && <circle className="bd-star" cx={x + 0.5} cy={y + 0.5} r={0.11} />}
              {d !== 0 && <circle className={`bd-stone bd-stone--${d === 1 ? 'b' : 'w'} ${g.last === i ? 'bd-stone--last' : ''} ${g.line.includes(i) ? 'bd-stone--win' : ''}`} cx={x + 0.5} cy={y + 0.5} r={0.43} />}
            </g>
          )
        })}
      </svg>
    </VsShell>
  )
}
export const GomokuScreen = () => <FiveRow mode="gomoku" />
export const PenteScreen = () => <FiveRow mode="pente" />
