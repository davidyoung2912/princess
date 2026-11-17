import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_GUESSES, WORD_LENGTH, backspace, keyStates, newGame, pickTarget, scoreGuess, shareText, submitGuess, typeLetter, type LetterState, type WordleGame } from '../../../domain/games/wordle'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Card } from '../../Card'
import { MoreLinks } from '../Parts'

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
const STATE_WORD: Record<LetterState, StringKey> = { correct: 'wordle.state.correct', present: 'wordle.state.present', absent: 'wordle.state.absent' }
/** How long the row takes to flip over, so the keyboard and the result wait for it. */
const REVEAL_MS = 1500

const reducedMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced')

/** Cruise Wordle: guess the hidden five-letter cruise or travel word in six tries. A new word is picked every game; nothing is stored. */
export function WordleScreen() {
  const [game, setGame] = useState<WordleGame>(() => newGame(pickTarget()))
  const [settled, setSettled] = useState(0)
  const [message, setMessage] = useState('')
  const [announce, setAnnounce] = useState('')
  const [shake, setShake] = useState(false)
  const gameRef = useRef(game)
  const settledRef = useRef(0)
  const timers = useRef<number[]>([])
  const resultRef = useRef<HTMLDivElement>(null)

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const apply = (next: WordleGame) => { gameRef.current = next; setGame(next) }

  const press = useCallback((key: string) => {
    const g = gameRef.current
    if (g.status !== 'playing') return
    if (key === 'ENTER') {
      if (g.guesses.length > settledRef.current) return // the last row is still flipping
      const r = submitGuess(g)
      if (r.problem) {
        setMessage(t('wordle.short'))
        setShake(true)
        later(() => setShake(false), 500)
        return
      }
      setMessage('')
      setAnnounce('')
      apply(r.game)
      const count = r.game.guesses.length
      later(() => {
        settledRef.current = count
        setSettled(count)
        const done = r.game
        if (done.status === 'won') setMessage(t(`wordle.win.${Math.min(count, MAX_GUESSES)}` as StringKey))
        else if (done.status === 'lost') setMessage(t('wordle.lost', { word: done.target }))
        else setAnnounce(summary(done.guesses[count - 1], done.target, count))
      }, reducedMotion() ? 0 : REVEAL_MS)
      return
    }
    setMessage('')
    apply(key === 'BACK' ? backspace(g) : typeLetter(g, key))
  }, [])

  // The physical keyboard. Enter on a focused button is left to the button, so a key is never pressed twice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (e.key === 'Enter') { if (target?.tagName === 'BUTTON' || target?.tagName === 'A') return; press('ENTER') }
      else if (e.key === 'Backspace') press('BACK')
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  const over = game.status !== 'playing' && settled === game.guesses.length
  useEffect(() => { if (over) resultRef.current?.focus() }, [over])

  const playAgain = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    settledRef.current = 0
    setSettled(0)
    setMessage('')
    apply(newGame(pickTarget(Math.random, gameRef.current.target)))
  }

  const share = async () => {
    const text = shareText(game, t('wordle.shareTitle'))
    try {
      if (typeof navigator.share === 'function') await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); setMessage(t('wordle.copied')) }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage(t('wordle.copyFail'))
    }
  }

  const keys = keyStates(game.guesses.slice(0, settled), game.target)
  const row = game.guesses.length
  return (
    <div className="page">
      <div className="wd">
        <details className="wd-help">
          <summary>{t('wordle.help.title')}</summary>
          <p>{t('wordle.help.1')}</p>
          <ul className="wd-help__list">
            <li><span className="wd-swatch" data-state="correct" aria-hidden="true" /> {t('wordle.help.correct')}</li>
            <li><span className="wd-swatch" data-state="present" aria-hidden="true" /> {t('wordle.help.present')}</li>
            <li><span className="wd-swatch" data-state="absent" aria-hidden="true" /> {t('wordle.help.absent')}</li>
          </ul>
          <p>{t('wordle.help.2')}</p>
        </details>

        <p className="wd-count" aria-hidden="true">{t('wordle.count', { n: Math.min(row + 1, MAX_GUESSES), max: MAX_GUESSES })}</p>
        <p className="wd-message" role="status">{message}</p>
        <p className="visually-hidden" role="status">{announce}</p>

        <div className="wd-board" role="grid" aria-label={t('wordle.board')}>
          {Array.from({ length: MAX_GUESSES }, (_, r) => {
            const submitted = r < game.guesses.length
            const word = submitted ? game.guesses[r] : r === row ? game.current : ''
            const scores = submitted ? scoreGuess(word, game.target) : []
            const flipping = submitted && r >= settled
            return (
              <div key={r} role="row" className={`wd-row${shake && r === row ? ' wd-row--shake' : ''}`}>
                {Array.from({ length: WORD_LENGTH }, (_, i) => {
                  const letter = word[i] ?? ''
                  const state = scores[i]
                  const label = `${t('wordle.cell', { n: r + 1, i: i + 1 })}: ${letter ? `${letter}${state ? `, ${t(STATE_WORD[state])}` : ''}` : t('wordle.empty')}`
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      aria-label={label}
                      className={`wd-tile${letter && !submitted ? ' wd-tile--filled' : ''}${flipping ? ' wd-tile--flip' : ''}`}
                      data-state={state}
                      style={flipping ? { animationDelay: `${i * 0.28}s` } : undefined}
                    >
                      <span aria-hidden="true">{letter}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {over && (
          <div ref={resultRef} tabIndex={-1} className="wd-result">
            <Card info>
              <h2 className="wd-result__title">{game.status === 'won' ? t('wordle.result.won') : t('wordle.result.lost')}</h2>
              <p>{game.status === 'won' ? t('wordle.result.wonBody', { n: game.guesses.length }) : t('wordle.lost', { word: game.target })}</p>
              <div className="button-row">
                <Button onClick={playAgain}>{t('wordle.playAgain')}</Button>
                <Button variant="secondary" onClick={share}>{t('wordle.share')}</Button>
              </div>
            </Card>
          </div>
        )}

        <div className="wd-keys" role="group" aria-label={t('wordle.keyboard')}>
          {ROWS.map((letters, i) => (
            <div key={letters} className="wd-keys__row">
              {i === 2 && <button type="button" className="wd-key wd-key--wide" onClick={() => press('ENTER')}>{t('wordle.enter')}</button>}
              {[...letters].map((l) => (
                <button key={l} type="button" className="wd-key" data-state={keys[l]} aria-label={keys[l] ? `${l}, ${t(STATE_WORD[keys[l]])}` : l} onClick={() => press(l)}>{l}</button>
              ))}
              {i === 2 && <button type="button" className="wd-key wd-key--wide" aria-label={t('wordle.delete')} onClick={() => press('BACK')}>⌫</button>}
            </div>
          ))}
        </div>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}

/** What a screen reader hears after a row is scored: each letter and how it did. */
function summary(guess: string, target: string, n: number): string {
  const parts = scoreGuess(guess, target).map((s, i) => `${guess[i]} ${t(STATE_WORD[s])}`)
  return `${t('wordle.guessN', { n })}: ${parts.join('. ')}.`
}
