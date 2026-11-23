import { useState, type CSSProperties } from 'react'
import { SIZE_OF, SLIDE_LEVELS, generate, hint as findHint, isSolved, tap, type SlideLevel } from '../../../games/domain/slide'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { dailySeed, usePref, useSoloRecord } from './board/shared'
import { SoloRecord } from './board/SoloRecord'
import { seededRng } from '../../../games/domain/cards'
import { useCardGame } from './cards/useCardGame'
import { GameHelp, LevelBar, SolvedCard } from './parts'

const NAMES: Record<SlideLevel, StringKey> = { easy: 'sl.level.easy', classic: 'sl.level.classic', hard: 'sl.level.hard' }

/** The sliding-tile puzzle. Tap a tile in the blank's row or column to slide the line. Hint finds a short way home with a weighted A* search. */
export function SlideScreen() {
  const [level, setLevel] = usePref<SlideLevel>('slide', 'level', SLIDE_LEVELS, 'classic')
  const [daily, setDaily] = useState(false)
  const n = SIZE_OF[level]
  const game = useCardGame(() => generate(n))
  const tiles = game.state
  const [hint, setHint] = useState<number | null>(null)
  const done = isSolved(tiles)

  const fresh = (l: SlideLevel) => { setLevel(l); setDaily(false); game.restart(generate(SIZE_OF[l])); setHint(null) }
  const today = () => { setDaily(true); game.restart(generate(n, seededRng(dailySeed(SLIDE_LEVELS.indexOf(level))))); setHint(null) }
  useSoloRecord('slide', daily ? `${level}-daily` : level, done ? 'win' : null, game.moves)
  const press = (i: number) => { if (done) return; const next = tap(tiles, i, n); if (next !== tiles) { game.commit(next); setHint(null) } }
  const giveHint = () => { const h = findHint(tiles, n); setHint(h === null || h < 0 ? null : h) }

  return (
    <div className="page">
      <div className="sd bd">
        <LevelBar name="slide-level" legend={t('sl.level.label')} levels={SLIDE_LEVELS.map((l) => ({ id: l, label: `${t(NAMES[l])} ${SIZE_OF[l]}×${SIZE_OF[l]}` }))} level={level} onLevel={fresh} />
        {daily && <p className="bd-note">{t('bd.daily.note')}</p>}
        <p className="sd-meta"><span>{t('peg.moves', { n: game.moves })}</span></p>
        <div className="bd-slide" role="group" aria-label={t('sl.aria')} style={{ '--n': n } as CSSProperties}>
          {tiles.map((v, i) => v === 0
            ? <span key={i} className="bd-slide__blank" aria-hidden="true" />
            : (
              <button key={i} type="button" className={`bd-tile ${v === i + 1 ? 'bd-tile--home' : ''} ${hint === i ? 'bd-tile--hint' : ''}`} onClick={() => press(i)} aria-label={t('sl.tile', { v })}>{v}</button>
            ))}
        </div>
        <div className="sd-tools bd-tools">
          <button type="button" className="sd-tool" onClick={today}><span>{t('bd.daily')}</span></button>
          <button type="button" className="sd-tool" onClick={giveHint} disabled={done}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('bd.hint')}</span></button>
          <button type="button" className="sd-tool" onClick={() => { game.undo(); setHint(null) }} disabled={!game.canUndo}><Undo aria-hidden="true" focusable="false" /><span>{t('bd.undo')}</span></button>
        </div>
        {done && (
          <SolvedCard title={t('sl.win.title')}>
            <p>{t('sl.win.body', { n: game.moves })}</p>
            <SoloRecord game="slide" keyName={daily ? `${level}-daily` : level} />
            <div className="button-row"><Button onClick={() => fresh(level)}>{t('bd.again')}</Button></div>
          </SolvedCard>
        )}
        <Button variant="secondary" onClick={() => fresh(level)}>{t('bd.new')}</Button>
        <GameHelp title={t('sudoku.help.title')}><p>{t('sl.help.1')}</p><p>{t('sl.help.2')}</p></GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
