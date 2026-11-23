import { useState } from 'react'
import { LIGHTS_LEVELS, SIZE_OF, generate, isOff, press, solution, type LightsLevel } from '../../../games/domain/lights'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { useRoving } from './board/shared'
import { useCardGame } from './cards/useCardGame'
import { GameHelp, LevelBar, SolvedCard } from './parts'

const NAMES: Record<LightsLevel, StringKey> = { easy: 'lo.level.easy', medium: 'lo.level.medium', hard: 'lo.level.hard' }

/** Lights Out: a tap flips a tile and the four beside it; turn every light off. Every puzzle is made from a real scramble, so it can always be solved, and Hint names a tile on the shortest way. */
export function LightsScreen() {
  const [level, setLevel] = useState<LightsLevel>('medium')
  const n = SIZE_OF[level]
  const game = useCardGame(() => generate('medium'))
  const board = game.state
  const [hint, setHint] = useState<number | null>(null)
  const done = isOff(board)
  const lit = board.filter(Boolean).length

  const fresh = (l: LightsLevel) => { setLevel(l); game.restart(generate(l)); setHint(null) }
  const tap = (i: number) => { if (done) return; game.commit(press(board, i, n)); setHint(null) }
  const { root, props } = useRoving(n, n * n, tap)
  const giveHint = () => { const s = solution(board, n); setHint(s && s.length ? s[0] : null) }

  return (
    <div className="page">
      <div className="sd bd">
        <LevelBar name="lights-level" legend={t('lo.level.label')} levels={LIGHTS_LEVELS.map((l) => ({ id: l, label: `${t(NAMES[l])} ${SIZE_OF[l]}×${SIZE_OF[l]}` }))} level={level} onLevel={fresh} />
        <p className="sd-meta"><span>{t('lo.lit', { n: lit })}</span><span>{t('peg.moves', { n: game.moves })}</span></p>
        <svg ref={root} className="bd-board bd-board--lights" viewBox={`0 0 ${n} ${n}`} role="group" aria-label={t('lo.aria', { n: lit })}>
          <rect className="bd-panel" x={0} y={0} width={n} height={n} rx={0.25} />
          {board.map((on, i) => (
            <g key={i} {...props(i)} onClick={() => tap(i)} aria-label={t(on ? 'lo.cell.on' : 'lo.cell.off', { r: Math.floor(i / n) + 1, c: (i % n) + 1 })} className="bd-hit">
              <rect className={`bd-light ${on ? 'bd-light--on' : ''} ${hint === i ? 'bd-light--hint' : ''}`} x={(i % n) + 0.07} y={Math.floor(i / n) + 0.07} width={0.86} height={0.86} rx={0.16} />
            </g>
          ))}
        </svg>
        <div className="sd-tools bd-tools">
          <button type="button" className="sd-tool" onClick={giveHint} disabled={done}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('bd.hint')}</span></button>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); setHint(null) }} disabled={!game.canUndo}><Undo aria-hidden="true" focusable="false" /><span>{t('bd.undo')}</span></button>
        </div>
        {done && (
          <SolvedCard title={t('lo.win.title')}>
            <p>{t('lo.win.body', { n: game.moves })}</p>
            <div className="button-row"><Button onClick={() => fresh(level)}>{t('bd.again')}</Button></div>
          </SolvedCard>
        )}
        <Button variant="secondary" onClick={() => fresh(level)}>{t('bd.new')}</Button>
        <GameHelp title={t('sudoku.help.title')}><p>{t('lo.help.1')}</p><p>{t('lo.help.2')}</p></GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
