import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { DIFFICULTIES, clock, type Difficulty } from '../../../domain/games/sudoku'
import { WORD_SEARCH_LEVELS, generateWordSearch, isWordSearchSolved, lineBetween, matchWord, nextWordHint } from '../../../domain/games/wordSearch'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Lightbulb } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard, useGameClock, useIncomingGame } from './parts'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const DIR_KEYS: StringKey[] = ['ws.dir.0', 'ws.dir.1', 'ws.dir.2', 'ws.dir.3', 'ws.dir.4', 'ws.dir.5', 'ws.dir.6', 'ws.dir.7']

/** A word found: which listed word, and the squares the player marked for it. */
type Found = { word: number; cells: number[] }

/**
 * Word Search with no spare letters: every square is in a listed word except a few that spell a hidden answer. Drag across a word, or tap its
 * first and last letters; from the keyboard use the arrow keys, Enter to mark the first letter, then arrows and Enter again for the last.
 * Nothing is stored.
 */
export function WordSearchScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('word-search')
  const sent = incoming && incoming.shared.game === 'word-search' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateWordSearch('easy'))
  const n = game.size
  const [found, setFound] = useState<Found[]>(() => (sent ? sent.puzzle.words.flatMap((w, k) => (sent.entries[k] ? [{ word: k, cells: w.cells }] : [])) : []))
  const [anchor, setAnchor] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const [cursor, setCursor] = useState(0)
  const [message, setMessage] = useState('')
  const [hint, setHint] = useState<{ text: string; word: number; cell: number } | null>(null)
  const [hints, setHints] = useState(0)
  const dragging = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const foundSet = useMemo(() => new Set(found.map((f) => f.word)), [found])
  const marked = useMemo(() => new Set(found.flatMap((f) => f.cells)), [found])
  const solved = isWordSearchSolved(game, foundSet)
  const { seconds, reset: resetClock } = useGameClock(!solved)
  const picking = useMemo(() => new Set(anchor === null ? [] : (end === null ? null : lineBetween(n, anchor, end)) ?? [anchor]), [anchor, end, n])
  const answerSet = useMemo(() => new Set(game.answerCells), [game.answerCells])

  /** Try the line between two squares as a word. */
  const tryLine = (a: number, b: number) => {
    const cells = lineBetween(n, a, b)
    setAnchor(null)
    setEnd(null)
    if (!cells || cells.length < 2) { setMessage(t('ws.none')); return }
    const k = matchWord(game, cells, foundSet)
    if (k < 0) { setMessage(t('ws.none')); return }
    setFound((f) => [...f, { word: k, cells }])
    setHint(null)
    const left = game.words.length - foundSet.size - 1
    setMessage(left === 0 ? '' : t('ws.found', { word: game.words[k].text, n: left }))
  }

  const cellAt = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-i]')
    return el ? Number(el.dataset.i) : null
  }

  const onPointerDown = (e: PointerEvent) => {
    if (solved) return
    const i = cellAt(e)
    if (i === null) return
    setCursor(i)
    if (anchor !== null && anchor !== i && !dragging.current) { tryLine(anchor, i); return }
    if (anchor === i) { setAnchor(null); setEnd(null); return }
    dragging.current = true
    boardRef.current?.setPointerCapture(e.pointerId)
    setAnchor(i)
    setEnd(i)
    setMessage('')
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return
    const i = cellAt(e)
    if (i !== null) setEnd(i)
  }

  const onPointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    if (anchor !== null && end !== null && end !== anchor) tryLine(anchor, end)
  }

  const moveCursor = (i: number) => {
    setCursor(i)
    if (anchor !== null) setEnd(i)
    boardRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || solved) return
    const r = Math.floor(cursor / n)
    const c = cursor % n
    const arrows: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    if (e.key in arrows) {
      e.preventDefault()
      const [dr, dc] = arrows[e.key]
      const nr = Math.min(n - 1, Math.max(0, r + dr))
      const nc = Math.min(n - 1, Math.max(0, c + dc))
      if (e.shiftKey && anchor === null) { setAnchor(cursor); setEnd(cursor) }
      moveCursor(nr * n + nc)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (anchor === null) { setAnchor(cursor); setEnd(cursor); setMessage('') }
      else if (anchor === cursor) { setAnchor(null); setEnd(null) }
      else tryLine(anchor, cursor)
    } else if (e.key === 'Escape') { setAnchor(null); setEnd(null); setHint(null) }
  }

  const showHint = () => {
    const h = nextWordHint(game, foundSet)
    if (!h) return
    setHints((x) => x + 1)
    setCursor(h.cell)
    setHint({ text: t('ws.hint', { letter: game.letters[h.cell], r: Math.floor(h.cell / n) + 1, c: (h.cell % n) + 1, dir: t(DIR_KEYS[h.dir]), len: game.words[h.word].text.length }), word: h.word, cell: h.cell })
  }

  const applyHint = () => {
    if (!hint) return
    setFound((f) => [...f, { word: hint.word, cells: game.words[hint.word].cells }])
    setHint(null)
  }

  const newPuzzle = () => {
    leaveChat()
    setGame(generateWordSearch(level))
    setFound([])
    setAnchor(null)
    setEnd(null)
    setCursor(0)
    setMessage('')
    setHint(null)
    setHints(0)
    resetClock()
  }

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="ws-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${WORD_SEARCH_LEVELS[d].size}×${WORD_SEARCH_LEVELS[d].size}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {n}×{n}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="ws-board" style={{ '--n': n } as CSSProperties} role="grid" aria-label={t('ws.board', { n })} onKeyDown={onKeyDown}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {Array.from({ length: n }, (_, r) => (
            <div key={r} role="row" className="ws-row">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c
                const classes = ['ws-cell']
                if (marked.has(i)) classes.push('ws-cell--found')
                if (picking.has(i)) classes.push('ws-cell--pick')
                if (i === anchor) classes.push('ws-cell--anchor')
                if (hint?.cell === i) classes.push('ws-cell--hint')
                if (solved && answerSet.has(i)) classes.push('ws-cell--answer')
                const parts = [t('sudoku.cell', { r: r + 1, c: c + 1 }), game.letters[i]]
                if (marked.has(i)) parts.push(t('ws.markedCell'))
                if (i === anchor) parts.push(t('ws.start'))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === cursor ? 0 : -1} aria-selected={picking.has(i)} aria-label={parts.join(', ')} className={classes.join(' ')}>
                    <span aria-hidden="true">{game.letters[i]}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {message && <p className="ws-message">{message}</p>}
          {hint && (
            <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}>
              <Button variant="secondary" onClick={applyHint}>{t('sudoku.hint.fill')}</Button>
            </HintBox>
          )}
        </div>

        {solved && (
          <SolvedCard title={t('sudoku.solved')}>
            <p>{t('ws.answer', { answer: game.answer })}</p>
            <p>{t('sudoku.solvedBody', { level: t(LEVEL_KEYS[game.difficulty]), time: clock(seconds), n: hints })}</p>
            <div className="button-row"><Button onClick={newPuzzle}>{t('sudoku.new')}</Button></div>
          </SolvedCard>
        )}

        <div className="ws-list">
          <h2 className="ws-list__title">{t('ws.list', { n: game.words.length - foundSet.size })}</h2>
          <ul className="ws-words">
            {game.words.map((w, k) => (
              <li key={w.text} className={foundSet.has(k) ? 'ws-word ws-word--found' : 'ws-word'}>
                {w.text}{foundSet.has(k) && <span className="visually-hidden"> {t('ws.wordFound')}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="sd-tools bn-tools">
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
          <button type="button" className="sd-tool" onClick={() => { setAnchor(null); setEnd(null) }} disabled={anchor === null}><span>{t('ws.clear')}</span></button>
          <GameShare shared={{ game: 'word-search', puzzle: game, entries: game.words.map((_, k) => (foundSet.has(k) ? 1 : 0)), notes: [] }} title={t('gx.game.wordsearch.title')} done={solved} seconds={seconds} />
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('ws.help.1')}</p>
          <p>{t('ws.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
