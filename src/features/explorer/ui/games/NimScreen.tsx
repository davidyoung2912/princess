import { useState } from 'react'
import { RULES, SIZES, SIZE_IDS, apply, chooseMove, perfectMove, start, type Move, type Nim, type NimSizeId, type Rule } from '../../../games/domain/nim'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { LevelBar } from './parts'
import { OPENINGS, useComputerTurn, useHint, usePref, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const NAMES: Record<NimSizeId, StringKey> = { three: 'nim.size.three', four: 'nim.size.four', five: 'nim.size.five' }

/** Nim against the computer: take any number of counters from one row. Tap a counter to choose it and all the counters to its right, then take them. */
export function NimScreen() {
  const [skill, setSkill] = usePref<Skill>('nim', 'skill', SKILL_LIST, 'captain')
  const [size, setSize] = usePref<NimSizeId>('nim', 'size', SIZE_IDS, 'four')
  const [rule, setRule] = usePref<Rule>('nim', 'rule', RULES, 'normal')
  const [opening, setOpening] = usePref<Opening>('nim', 'opening', OPENINGS, 'you')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Nim>(() => start(SIZES.four, 'normal'))
  const g = game.state
  const [pick, setPick] = useState<Move | null>(null)
  const hint = useHint<Nim, Move>()
  const over = g.winner !== 0
  const mine = !over && g.turn === 1
  const taking = (pick && pick.take <= (g.heaps[pick.heap] ?? 0)) ? pick : null

  const take = () => { if (!taking) return; const next = apply(g, taking); if (next) { game.commit(next); setPick(null) } }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m) { const next = apply(g, m); if (next) game.commit(next) } })
  const reset = () => { game.restart({ ...start(SIZES[size], rule), turn: opening === 'you' ? 1 : 2 }); setPick(null); hint.reset() }
  const h = hint.of(g)

  return (
    <VsShell
      game="nim" name="nim" skill={skill} onSkill={setSkill} opening={opening} onOpening={setOpening} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<>
        <LevelBar name="nim-size" legend={t('nim.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: t(NAMES[s], { n: SIZES[s].length }) }))} level={size} onLevel={setSize} />
        <LevelBar name="nim-rule" legend={t('nim.rule.label')} levels={RULES.map((r) => ({ id: r, label: t(r === 'normal' ? 'nim.rule.normal' : 'nim.rule.misere') }))} level={rule} onLevel={setRule} />
      </>}
      status={mine ? (taking ? t('nim.take', { n: taking.take }) : t('nim.pick')) : t('bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(g.winner === 1 ? 'bd.win' : 'bd.lose'), body: t(g.rule === 'normal' ? 'nim.final.normal' : 'nim.final.misere'), outcome: g.winner === 1 ? 'win' : 'loss' } : null}
      meta={<span>{t(g.rule === 'normal' ? 'nim.rule.normal' : 'nim.rule.misere')}</span>}
      hint={{ run: () => { const m = perfectMove(g); if (m) hint.give(g, m); else { const mv = chooseMove(g, 'admiral'); if (mv) hint.give(g, mv) } }, shown: h !== null, used: hint.used }}
      help={<><p>{t('nim.help.1')}</p><p>{t('nim.help.2')}</p></>}
    >
      <div className="bd-nim" role="group" aria-label={t('nim.aria')}>
        {g.heaps.map((n, hi) => (
          <div key={hi} className="bd-nim__row" role="group" aria-label={t('nim.row', { n: hi + 1, c: n })}>
            {Array.from({ length: n }, (_, k) => {
              const chosen = taking?.heap === hi && k >= n - taking.take
              const hinted = h?.heap === hi && k >= n - h.take
              return <button key={k} type="button" className={`bd-stick ${chosen ? 'bd-stick--on' : ''} ${hinted ? 'bd-stick--hint' : ''}`} disabled={!mine} aria-pressed={chosen} aria-label={t('nim.stick', { n: n - k })} onClick={() => setPick({ heap: hi, take: n - k })} />
            })}
            {n === 0 && <span className="bd-nim__empty" aria-hidden="true">·</span>}
          </div>
        ))}
      </div>
      {mine && <Button onClick={take} disabled={!taking}>{taking ? t('nim.takebtn', { n: taking.take }) : t('nim.pick')}</Button>}
    </VsShell>
  )
}
