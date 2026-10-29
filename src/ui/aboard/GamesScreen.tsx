import { ACHIEVEMENTS, HUNT, TRIVIA, achievements, bingoCard, bingoLines, calledNumbers, triviaScore } from '../../domain/games'
import { placeById } from '../../domain/deck'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { AboardError, Back } from './common'

/** Games on board (ENT-05): a scavenger hunt, trivia, a bingo card and the badges they earn. Progress is kept on the account. */
export function GamesScreen() {
  const game = useMine(() => api.aboard.games.get())
  const me = usePersona()
  const now = useNow()
  const find = useAction(async (id: string, on: boolean) => { await api.aboard.games.find(id, on); game.retry() })
  const answer = useAction(async (id: string, option: number) => { await api.aboard.games.answer(id, option); game.retry() })
  const mark = useAction(async (n: number, on: boolean) => { await api.aboard.games.mark(n, on); game.retry() })
  const card = bingoCard(me?.id ?? 'guest')
  const called = calledNumbers(1 + (Math.floor(now / 86_400_000) % 7), Math.floor((now % 3_600_000) / 60_000))
  return (
    <div className="page">
      <h1>{t('route.games')}</h1>
      <p>{t('game.intro')}</p>
      <AboardError error={find.error ?? answer.error ?? mark.error} />
      <Load state={game}>
        {(g) => {
          const score = triviaScore(g)
          const earned = achievements(g, card)
          return (
            <>
              <Card labelledBy="ach-h">
                <h2 id="ach-h" className="card__title">{t('game.badges')}</h2>
                <ul className="plain-bullets">
                  {ACHIEVEMENTS.map((a) => <li key={a}>{earned.includes(a) ? '✓ ' : '○ '}<strong>{t(`game.a.${a}` as StringKey)}</strong> <span className="muted">{t(`game.a.${a}.how` as StringKey)}</span></li>)}
                </ul>
              </Card>

              <section aria-labelledby="hunt-h">
                <h2 id="hunt-h">{t('game.hunt')}</h2>
                <p>{t('game.huntBody', { found: g.found.length, total: HUNT.length })}</p>
                <ul className="card-grid">
                  {HUNT.map((c) => (
                    <li key={c.id}>
                      <Card>
                        <p>{c.clue}</p>
                        <p className="muted">{g.found.includes(c.id) ? t('game.foundAt', { place: placeById(c.placeId)?.name ?? '' }) : t('game.hint', { deck: placeById(c.placeId)?.deck ?? 0 })}</p>
                        <Button variant="secondary" disabled={find.busy || !!me?.child} onClick={() => void find.run(c.id, !g.found.includes(c.id))}>{g.found.includes(c.id) ? t('game.unfind') : t('game.found')}</Button>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="trivia-h">
                <h2 id="trivia-h">{t('game.trivia')}</h2>
                <p role="status">{t('game.score', { right: score.right, answered: score.answered, total: TRIVIA.length })}</p>
                {TRIVIA.map((q) => {
                  const chosen = g.answers[q.id]
                  return (
                    <fieldset key={q.id} className="plain-fieldset">
                      <legend>{q.text}</legend>
                      {q.options.map((o, i) => (
                        <label key={o} className="choice choice--top">
                          <input type="radio" name={q.id} checked={chosen === i} disabled={chosen !== undefined || answer.busy} onChange={() => void answer.run(q.id, i)} />
                          <span>{o}</span>
                        </label>
                      ))}
                      {chosen !== undefined && <p role="status">{chosen === q.answer ? t('game.right') : t('game.wrong', { answer: q.options[q.answer] })}</p>}
                    </fieldset>
                  )
                })}
              </section>

              <section aria-labelledby="bingo-h">
                <h2 id="bingo-h">{t('game.bingo')}</h2>
                <p>{t('game.bingoBody', { lines: bingoLines(card, g.marked) })}</p>
                {bingoLines(card, g.marked) > 0 && <Banner kind="success" title={t('game.bingoWon')}><p>{t('game.bingoWonBody')}</p></Banner>}
                <table className="bingo" aria-label={t('game.bingoCard')}>
                  <thead><tr>{['B', 'I', 'N', 'G', 'O'].map((l) => <th key={l} scope="col">{l}</th>)}</tr></thead>
                  <tbody>
                    {card.map((row, r) => (
                      <tr key={r}>
                        {row.map((n, c) => (
                          <td key={c}>
                            {n === 0 ? <span className="bingo__free">{t('game.free')}</span> : (
                              <button type="button" className="bingo__cell" aria-pressed={g.marked.includes(n)} disabled={mark.busy || !!me?.child} onClick={() => void mark.run(n, !g.marked.includes(n))}>
                                {n}{called.includes(n) ? <span className="visually-hidden"> {t('game.called')}</span> : null}
                                {called.includes(n) && <span aria-hidden="true" className="bingo__dot">●</span>}
                              </button>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted">{t('game.bingoNote')}</p>
              </section>
            </>
          )
        }}
      </Load>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}
