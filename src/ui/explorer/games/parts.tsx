import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clock } from '../../../domain/games/sudoku'
import { startVisibleInterval } from '../../../hooks/visibleInterval'
import { Card } from '../../Card'
import { Ask, Clock, X } from '../../icons'

/** The pieces every game shares, so the games look and behave the same: How to Play, clock, level picker, hint box and solved card. */

/** A clock that counts seconds while `running` and the page is showing. `reset` starts it again from 0:00. */
export function useGameClock(running: boolean): { seconds: number; reset: () => void } {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => (running ? startVisibleInterval(() => setSeconds((s) => s + 1), 1000) : undefined), [running])
  return { seconds, reset: () => setSeconds(0) }
}

/** The 0:07 style timer with its clock icon. */
export function GameClock({ seconds, label }: { seconds: number; label: string }) {
  return <span className="game-clock" role="timer" aria-label={label}><Clock aria-hidden="true" focusable="false" />{clock(seconds)}</span>
}

/** The collapsible How to Play panel shown under the game. */
export function GameHelp({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="game-help">
      <summary><Ask aria-hidden="true" focusable="false" />{title}</summary>
      {children}
    </details>
  )
}

/** The level picker: a row of radio buttons styled as a segmented control, with the New puzzle button beside it. */
export function LevelBar<L extends string>({ name, legend, levels, level, onLevel, children }: {
  name: string
  legend: string
  levels: readonly { id: L; label: string }[]
  level: L
  onLevel: (level: L) => void
  children?: ReactNode
}) {
  return (
    <div className="game-bar">
      <fieldset className="game-levels">
        <legend className="visually-hidden">{legend}</legend>
        {levels.map((l) => (
          <label key={l.id} className="game-level">
            <input type="radio" className="visually-hidden" name={name} checked={level === l.id} onChange={() => onLevel(l.id)} />
            <span>{l.label}</span>
          </label>
        ))}
      </fieldset>
      {children}
    </div>
  )
}

/** A hint with a dismiss button; `children` holds the action buttons (Fill it in, Clear them). */
export function HintBox({ text, dismissLabel, onDismiss, children }: { text: string; dismissLabel: string; onDismiss: () => void; children?: ReactNode }) {
  return (
    <div className="game-hint">
      <button type="button" className="game-hint__close" aria-label={dismissLabel} onClick={onDismiss}><X aria-hidden="true" focusable="false" /></button>
      <p>{text}</p>
      {children && <div className="button-row">{children}</div>}
    </div>
  )
}

/** The result card shown when a game ends. It takes focus when it appears so a screen reader reads it. */
export function SolvedCard({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div ref={ref} tabIndex={-1} className="game-result">
      <Card info>
        <h2 className="game-result__title">{title}</h2>
        {children}
      </Card>
    </div>
  )
}
