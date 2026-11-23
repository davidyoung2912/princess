import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clock } from '../../../games/domain/sudoku'
import { beatOutcome, elapsedNow, heldTarget } from '../../../games/domain/incoming'
import { encodeGame, resultData, type ShareMode, type SharedGame } from '../../../games/domain/share'
import { Button, LinkButton } from '../../../../shared/ui/Button'
import { Card } from '../../../../shared/ui/Card'
import { Dialog } from '../../../../shared/ui/Dialog'
import { SendDialog } from '../../../onboard/ui/SendDialog'
import { headingCase, t } from '../../../../shared/i18n'
import { Ask, Clock, X } from '../../../../shared/ui/icons'
import { MessageSquarePlus } from 'lucide-react'
import { useSettings } from '../../../../shared/hooks/useSettings'
import { playCue } from '../../../../shared/sound/cues'
import { BUZZ, buzz } from '../../../../shared/settings/haptics'

/** The pieces every game shares, so the games look and behave the same: How to Play, clock, level picker, hint box and solved card. */

/** The 0:07 style timer with its clock icon. */
export function GameClock({ seconds, label }: { seconds: number; label: string }) {
  return <span className="game-clock" role="timer" aria-label={label}><Clock aria-hidden="true" focusable="false" />{clock(seconds)}</span>
}

/** The collapsible How to Play panel shown under the game. */
export function GameHelp({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="game-help" data-tour="game-help">
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

/** Phase B10: when the puzzle came from a result in a chat, how this attempt went against the time to beat. Nothing when it did not. */
function BeatLine() {
  const target = heldTarget()
  const outcome = beatOutcome(elapsedNow(), target)
  if (!outcome || target === undefined) return null
  return <p role="status">{t(`game.beat.${outcome.result}`, { time: clock(target), gap: clock(outcome.gap) })}</p>
}

/** The result card shown when a game ends. It takes focus when it appears so a screen reader reads it. */
export function SolvedCard({ title, tone = 'win', children }: { title: string; /** How it ended, for the sound and buzz: a bright two-note click for a win, a low tick for a loss, a soft click for a draw. */ tone?: 'win' | 'loss' | 'draw'; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [settings] = useSettings()
  useEffect(() => {
    ref.current?.focus()
    playCue(tone === 'win' ? 'success' : tone === 'loss' ? 'no' : 'confirm', settings)
    buzz(settings, tone === 'win' ? BUZZ.moment : BUZZ.tick)
    // Once, when the card appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={ref} tabIndex={-1} className="game-result">
      <Card info>
        <h2 className="game-result__title">{title}</h2>
        <BeatLine />
        {children}
      </Card>
    </div>
  )
}

/** The line above a puzzle that came from a chat: where it came from, a way back, and a way to a puzzle of the player's own. */
export function IncomingNote({ mode, onFresh }: { mode: ShareMode; onFresh: () => void }) {
  const target = heldTarget()
  return (
    <div className="game-hint" role="status">
      <p>{t(mode === 'start' ? 'game.incoming.start' : 'game.incoming.current')}{target ? ` ${t('game.incoming.beat', { time: clock(target) })}` : ''}</p>
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
export function GameShare({ shared, title, done = false, seconds = 0 }: { shared: SharedGame; title: string; /** The puzzle is finished, so "My result" can be sent. */ done?: boolean; seconds?: number }) {
  const [step, setStep] = useState<'closed' | 'choose' | 'send'>('closed')
  const [pick, setPick] = useState<ShareMode | 'result'>('start')
  const mode: ShareMode = pick === 'current' ? 'current' : 'start'
  const result = pick === 'result' && done
  const [notes, setNotes] = useState(false)
  const hasNotes = shared.notes.some((m) => m !== 0)
  const data = () => (result ? resultData(shared, seconds) : encodeGame(shared, mode, notes))
  const level = shared.puzzle.difficulty
  return (
    <>
      <button type="button" className="sd-tool" aria-label={t('game.share.label')} onClick={() => setStep('choose')}><MessageSquarePlus aria-hidden="true" focusable="false" /><span>{t('game.share')}</span></button>
      {step === 'choose' && (
        <Dialog title={t('game.share.title')} onClose={() => setStep('closed')}>
          <div className="send-dialog">
            <fieldset className="send-dialog__how">
              <legend>{t('game.share.what')}</legend>
              <label className="send-dialog__row"><input type="radio" name="game-share-mode" checked={pick === 'start'} onChange={() => setPick('start')} /><span>{t('game.share.start')}</span></label>
              <label className="send-dialog__row"><input type="radio" name="game-share-mode" checked={pick === 'current'} onChange={() => setPick('current')} /><span>{t('game.share.current')}</span></label>
              {done && <label className="send-dialog__row"><input type="radio" name="game-share-mode" checked={pick === 'result'} onChange={() => setPick('result')} /><span>{t('game.share.result', { time: clock(seconds) })}</span></label>}
            </fieldset>
            {pick === 'current' && hasNotes && <label className="send-dialog__row"><input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} /><span>{t('game.share.notes')}</span></label>}
            <p className="muted">{t(result ? 'game.share.resultHint' : 'game.share.hint')}</p>
            <Button onClick={() => setStep('send')}>{t('game.share.next')}</Button>
          </div>
        </Dialog>
      )}
      {step === 'send' && (
        <SendDialog onClose={() => setStep('closed')} item={{
          title, subtitle: `${shared.game === 'cruise-wordle' ? '' : `${level}, `}${result ? t('game.share.result', { time: clock(seconds) }).toLowerCase() : t(mode === 'start' ? 'game.share.start' : 'game.share.current').toLowerCase()}`, takesNote: true,
          input: (note) => ({ kind: 'bundle', shareRef: `game:${shared.game}:${result ? 'result' : mode}`, data: data(), ...(note ? { note } : {}) }),
        }} />
      )}
    </>
  )
}
