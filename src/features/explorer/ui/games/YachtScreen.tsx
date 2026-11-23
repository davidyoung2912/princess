import { useState } from 'react'
import { CATS, act, bestCategory, bestHold, choose, isOver, open, roll, scoreOf, score, start, toggleHold, total, winner, type Cat, type Yacht } from '../../../games/domain/yacht'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { OPENINGS, useComputerTurn, useHint, usePref, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const CAT_KEYS: Record<Cat, StringKey> = { ones: 'ya.cat.ones', twos: 'ya.cat.twos', threes: 'ya.cat.threes', fours: 'ya.cat.fours', fives: 'ya.cat.fives', sixes: 'ya.cat.sixes', fullHouse: 'ya.cat.fullHouse', fourKind: 'ya.cat.fourKind', littleStraight: 'ya.cat.littleStraight', bigStraight: 'ya.cat.bigStraight', choice: 'ya.cat.choice', yacht: 'ya.cat.yacht' }
const PIPS: Record<number, [number, number][]> = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] }

/** Yacht against the computer: five dice, three rolls a turn, twelve categories to fill. Tap dice to keep them, then roll again or tap a category to score. */
export function YachtScreen() {
  const [skill, setSkill] = usePref<Skill>('yacht', 'skill', SKILL_LIST, 'captain')
  const [opening, setOpening] = usePref<Opening>('yacht', 'opening', OPENINGS, 'you')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Yacht>(start)
  const g = game.state
  const hint = useHint<Yacht, { held: boolean[]; cat: Cat | null }>()
  const over = isOver(g)
  const mine = !over && g.turn === 0
  const h = hint.of(g)
  const mineOpen = open(g.cards[0])

  useComputerTurn(started && !over && g.turn === 1, skill, g, () => game.commit(act(g, choose(g, skill))))
  const reset = () => { game.restart({ ...start(), turn: opening === 'you' ? 0 : 1 }); hint.reset() }
  const w = winner(g)
  const a = total(g.cards[0]), b = total(g.cards[1])

  const giveHint = () => {
    if (!mine || !g.rolled) return
    const held = g.rollsLeft > 0 ? bestHold(g.cards[0], g.dice, g.rollsLeft) : Array(5).fill(true)
    hint.give(g, { held, cat: held.every(Boolean) ? bestCategory(g.cards[0], g.dice) : null })
  }

  return (
    <VsShell
      game="yacht" name="yacht" skill={skill} onSkill={setSkill} opening={opening} onOpening={setOpening} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      status={!mine ? t('ya.cpu') : !g.rolled ? t('ya.roll') : g.rollsLeft > 0 ? t('ya.keep', { n: g.rollsLeft }) : t('ya.score')} thinking={!mine && !over}
      result={over ? { title: t(w === 1 ? 'bd.win' : w === 2 ? 'bd.lose' : 'bd.draw'), body: t('ya.final', { a, b }), outcome: w === 1 ? 'win' : w === 2 ? 'loss' : 'draw' } : null}
      meta={<span>{t('db.score', { a, b })}</span>}
      hint={{ run: giveHint, shown: h !== null, used: hint.used }}
      help={<><p>{t('ya.help.1')}</p><p>{t('ya.help.2')}</p></>}
    >
      <div className="bd-yacht">
        <div className="bd-yacht__dice" role="group" aria-label={t('ya.dice')}>
          {g.dice.map((d, i) => (
            <button key={i} type="button" className={`bd-ydie ${g.held[i] && g.rolled ? 'bd-ydie--held' : ''} ${h?.held[i] ? 'bd-ydie--hint' : ''}`} disabled={!mine || !g.rolled || g.rollsLeft === 0} aria-pressed={g.held[i] && g.rolled} aria-label={t(g.held[i] && g.rolled ? 'ya.die.held' : 'ya.die', { n: d })} onClick={() => game.commit(toggleHold(g, i))}>
              <svg viewBox="0 0 3 3" aria-hidden="true"><rect x={0.05} y={0.05} width={2.9} height={2.9} rx={0.4} className="bd-die-face" />{g.rolled && PIPS[d].map(([x, y], k) => <circle key={k} cx={x + 0.5} cy={y + 0.5} r={0.22} className="bd-die-pip" />)}</svg>
            </button>
          ))}
        </div>
        {mine && <Button onClick={() => game.commit(roll({ ...g }))} disabled={g.rollsLeft === 0}>{g.rolled ? t('ya.rollagain', { n: g.rollsLeft }) : t('bk.rollbtn')}</Button>}
        <table className="bd-ycard">
          <caption className="visually-hidden">{t('ya.card')}</caption>
          <thead><tr><th scope="col">{t('ya.cat')}</th><th scope="col">{t('pig.you')}</th><th scope="col">{t('pig.cpu')}</th></tr></thead>
          <tbody>
            {CATS.map((c, i) => {
              const mineV = g.cards[0][i], theirV = g.cards[1][i]
              const can = mine && g.rolled && mineOpen.includes(c)
              return (
                <tr key={c}>
                  <th scope="row">{t(CAT_KEYS[c])}</th>
                  <td>{mineV !== null ? mineV : can ? <button type="button" className={`bd-ycell ${h?.cat === c ? 'bd-ycell--hint' : ''}`} onClick={() => { game.commit(score(g, c)); hint.reset() }} aria-label={t('ya.take', { cat: t(CAT_KEYS[c]), n: scoreOf(c, g.dice) })}>{scoreOf(c, g.dice)}</button> : ''}</td>
                  <td>{theirV !== null ? theirV : ''}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot><tr><th scope="row">{t('ya.total')}</th><td>{a}</td><td>{b}</td></tr></tfoot>
        </table>
      </div>
    </VsShell>
  )
}
