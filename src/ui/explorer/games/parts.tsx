import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clock } from '../../../domain/games/sudoku'
import { startVisibleInterval } from '../../../hooks/visibleInterval'
import { clearIncoming, peekIncoming } from '../../../domain/games/incoming'
import { encodeGame, startOnly, type ShareMode, type SharedGame } from '../../../domain/games/share'
import { Button, LinkButton } from '../../Button'
import { Card } from '../../Card'
import { Dialog } from '../../Dialog'
import { SendDialog } from '../../onboard/SendDialog'
import { headingCase, t } from '../../../i18n'
import { Ask, Clock, X } from '../../icons'
import { MessageSquarePlus } from 'lucide-react'

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
      <summary><Ask aria-hidden="true" focusable="false" />{headingCase(title)}</summary>
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

/**
 * The puzzle a chat card handed to this game (docs/chat-bundles-plan.md, B8), read once when the screen opens and forgotten when it closes. `shared` is already the clues alone when the
 * sender chose the starting position, and `fresh` ends the "from a chat" note when the player moves on to a puzzle of their own.
 */
export function useIncomingGame(game: string): { incoming: { shared: SharedGame; mode: ShareMode } | null; fromChat: ShareMode | null; leaveChat: () => void } {
  const [incoming] = useState(() => { const held = peekIncoming(game); return held ? { shared: held.mode === 'start' ? startOnly(held.shared) : held.shared, mode: held.mode } : null })
  const [fromChat, setFromChat] = useState<ShareMode | null>(incoming?.mode ?? null)
  useEffect(() => () => clearIncoming(), [])
  return { incoming, fromChat, leaveChat: () => setFromChat(null) }
}

/** The line above a puzzle that came from a chat: where it came from, a way back, and a way to a puzzle of the player's own. */
export function IncomingNote({ mode, onFresh }: { mode: ShareMode; onFresh: () => void }) {
  return (
    <div className="game-hint" role="status">
      <p>{t(mode === 'start' ? 'game.incoming.start' : 'game.incoming.current')}</p>
      <div className="button-row">
        <LinkButton to="/chat" variant="secondary">{t('game.incoming.back')}</LinkButton>
        <Button variant="secondary" onClick={onFresh}>{t('game.incoming.fresh')}</Button>
      </div>
    </div>
  )
}

/**
 * "Send to chat" on a game: choose the starting position or the board so far (and whether pencil notes go too), then the shared send dialog. What goes is the clues and the player's entries,
 * never the solution; the server writes the card's words and keeps the puzzle text as it came.
 */
export function GameShare({ shared, title }: { shared: SharedGame; title: string }) {
  const [step, setStep] = useState<'closed' | 'choose' | 'send'>('closed')
  const [mode, setMode] = useState<ShareMode>('start')
  const [notes, setNotes] = useState(false)
  const hasNotes = shared.notes.some((m) => m !== 0)
  const data = () => encodeGame(shared, mode, notes)
  const level = shared.puzzle.difficulty
  return (
    <>
      <button type="button" className="sd-tool" aria-label={t('game.share.label')} onClick={() => setStep('choose')}><MessageSquarePlus aria-hidden="true" focusable="false" /><span>{t('game.share')}</span></button>
      {step === 'choose' && (
        <Dialog title={t('game.share.title')} onClose={() => setStep('closed')}>
          <div className="send-dialog">
            <fieldset className="send-dialog__how">
              <legend>{t('game.share.what')}</legend>
              <label className="send-dialog__row"><input type="radio" name="game-share-mode" checked={mode === 'start'} onChange={() => setMode('start')} /><span>{t('game.share.start')}</span></label>
              <label className="send-dialog__row"><input type="radio" name="game-share-mode" checked={mode === 'current'} onChange={() => setMode('current')} /><span>{t('game.share.current')}</span></label>
            </fieldset>
            {mode === 'current' && hasNotes && <label className="send-dialog__row"><input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} /><span>{t('game.share.notes')}</span></label>}
            <p className="muted">{t('game.share.hint')}</p>
            <Button onClick={() => setStep('send')}>{t('game.share.next')}</Button>
          </div>
        </Dialog>
      )}
      {step === 'send' && (
        <SendDialog onClose={() => setStep('closed')} item={{
          title, subtitle: `${shared.game === 'cruise-wordle' ? '' : `${level}, `}${t(mode === 'start' ? 'game.share.start' : 'game.share.current').toLowerCase()}`, takesNote: true,
          input: (note) => ({ kind: 'bundle', shareRef: `game:${shared.game}:${mode}`, data: data(), ...(note ? { note } : {}) }),
        }} />
      )}
    </>
  )
}
