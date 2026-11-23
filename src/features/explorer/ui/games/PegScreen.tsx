import { useState } from 'react'
import { LAYOUTS, PEG_BOARDS, count, isPerfect, isStuck, isWon, jump, movesOf, rating, solve, start, type Jump, type PegBoard } from '../../../games/domain/peg'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { usePref, useRoving, useSoloRecord } from './board/shared'
import { SoloRecord } from './board/SoloRecord'
import { useCardGame } from './cards/useCardGame'
import { GameHelp, LevelBar, SolvedCard } from './parts'

const NAMES: Record<PegBoard, StringKey> = { english: 'peg.board.english', french: 'peg.board.french', triangle: 'peg.board.triangle' }

/** Where a hole sits in the drawing, in board units (the triangle is centred, each row shifted half a step). */
const pos = (b: PegBoard, i: number): [number, number] => {
  const L = LAYOUTS[b]
  const [r, c] = L.holes[i]
  return b === 'triangle' ? [c - r / 2 + (L.rows - 1) / 2 + 0.5, r + 0.5] : [c + 0.5, r + 0.5]
}

/** Peg solitaire on three boards: jump a peg over a neighbour into an empty hole and take the peg jumped. Leave one. Hints come from a real search, so they always lead to a win. */
export function PegScreen() {
  const [board, setBoard] = usePref<PegBoard>('peg', 'board', PEG_BOARDS, 'english')
  const game = useCardGame(() => start(board))
  const pegs = game.state
  const [from, setFrom] = useState<number | null>(null)
  const [hint, setHint] = useState<Jump | null>(null)
  const [note, setNote] = useState('')
  const L = LAYOUTS[board]
  const moves = movesOf(board, pegs)
  const left = count(pegs)
  const won = isWon(pegs)
  const stuck = isStuck(board, pegs)
  const width = board === 'triangle' ? L.rows : L.cols
  useSoloRecord('peg', board, won ? 'win' : stuck ? 'loss' : null, game.moves)
  const targets = from === null ? [] : moves.filter((m) => m.from === from)

  const newGame = (b: PegBoard) => { setBoard(b); game.restart(start(b)); setFrom(null); setHint(null); setNote('') }
  const pick = (i: number) => {
    if (won || stuck) return
    setHint(null)
    const m = targets.find((x) => x.to === i)
    if (m) { game.commit(jump(pegs, m)); setFrom(null); setNote(''); return }
    if (pegs[i] && moves.some((x) => x.from === i)) { setFrom(i === from ? null : i); setNote('') } else { setFrom(null); setNote(pegs[i] ? t('peg.stuck.peg') : '') }
  }
  const { root, props } = useRoving(L.cols, L.holes.length, pick)
  const giveHint = () => {
    if (won || stuck) return
    const line = solve(board, pegs)
    if (!line || line.length === 0) { setNote(t('peg.hint.none')); setHint(null); return }
    setHint(line[0]); setFrom(null); setNote(t('peg.hint.found'))
  }

  return (
    <div className="page">
      <div className="sd bd">
        <LevelBar name="peg-board" legend={t('peg.board.label')} levels={PEG_BOARDS.map((b) => ({ id: b, label: t(NAMES[b]) }))} level={board} onLevel={newGame} />
        <p className="sd-meta"><span>{t('peg.left', { n: left })}</span><span>{t('peg.moves', { n: game.moves })}</span></p>
        <svg ref={root} className="bd-board bd-board--peg" viewBox={`0 0 ${width} ${L.rows}`} role="group" aria-label={t('peg.aria', { n: left })}>
          <rect className="bd-wood" x={0.02} y={0.02} width={width - 0.04} height={L.rows - 0.04} rx={0.4} />
          {L.holes.map((_, i) => {
            const [x, y] = pos(board, i)
            const on = pegs[i]
            const target = targets.some((m) => m.to === i)
            const hinted = hint && (hint.from === i || hint.to === i)
            return (
              <g key={i} {...props(i)} onClick={() => pick(i)} aria-label={t(on ? 'peg.cell.peg' : target ? 'peg.cell.target' : 'peg.cell.hole')} aria-pressed={on ? from === i : undefined} className="bd-hit">
                <circle className="bd-hole" cx={x} cy={y} r={0.34} />
                {on && <circle className={`bd-peg ${from === i ? 'bd-peg--on' : ''} ${hinted ? 'bd-peg--hint' : ''}`} cx={x} cy={y} r={0.3} />}
                {target && <circle className="bd-target" cx={x} cy={y} r={0.2} />}
                {!on && hinted && <circle className="bd-target bd-target--hint" cx={x} cy={y} r={0.24} />}
              </g>
            )
          })}
        </svg>
        <p className="bd-note" role="status">{note || t('peg.tip')}</p>
        <div className="sd-tools bd-tools">
          <button type="button" className="sd-tool" onClick={giveHint} disabled={won || stuck}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('bd.hint')}</span></button>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); setFrom(null); setHint(null); setNote('') }} disabled={!game.canUndo}><Undo aria-hidden="true" focusable="false" /><span>{t('bd.undo')}</span></button>
        </div>
        {(won || stuck) && (
          <SolvedCard title={t(`peg.result.${rating(left)}` as StringKey)}>
            <p>{t(won ? (isPerfect(board, pegs) ? 'peg.result.perfect' : 'peg.result.won') : 'peg.result.stuck', { n: left })}</p>
            <SoloRecord game="peg" keyName={board} />
            <div className="button-row"><Button onClick={() => newGame(board)}>{t('bd.again')}</Button></div>
          </SolvedCard>
        )}
        <Button variant="secondary" onClick={() => newGame(board)}>{t('bd.new')}</Button>
        <GameHelp title={t('sudoku.help.title')}><p>{t('peg.help.1')}</p><p>{t('peg.help.2')}</p></GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
