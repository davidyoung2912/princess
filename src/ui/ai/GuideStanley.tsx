import { useState } from 'react'
import { Link } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import { normalizeAction, type StanleyAction } from '../../ai/stanleyAction'
import { chipsFor, questionOf, type LibraryEntry } from '../../ai/stanleyLibrary'
import type { GuideTask, GuideView } from '../../api/guideTypes'
import { demoNow } from '../../demo/store'
import { isoDay } from '../../domain/rates'
import { taskCalendarFile } from '../../guide/calendar'
import { CalendarButton } from '../delights/Cards'
import { doItArgs, doItFor, helpScreenId, nowTask, remindDay, taskRemindArgs, tourChoices } from '../../guide/stanley'
import { useSettings } from '../../hooks/useSettings'
import { stanleyLevelFor } from '../../settings/settings'
import { taskMeta, taskWords } from '../../guide/words'
import { t } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { stanleyActions } from '../../runtime'
import { Button, LinkButton } from '../Button'
import { GuideIconButton } from '../GuideIconButton'
import { Bell, CalendarPlus, Help } from '../icons'
import { downloadText } from '../delights/cardTools'
import { Dialog } from '../Dialog'
import { DialogHeader } from '../DialogHeader'
import { StanleyActionCard } from './StanleyActionCard'
import { StanleyAnswer } from './StanleyChips'

const Header = ({ titleId, onClose }: { titleId: string; onClose: () => void }) => (
  <DialogHeader titleId={titleId} title={t('stanley.sheet.title')} subtext={t('stanley.sheet.sub')} onClose={onClose}
    image={<img className="stanley__avatar" src={stanley} alt="" width="192" height="192" />} />
)

/**
 * "What should I do now?" answered from the guest's guide, never by a model: the first task, why, when it is due, and a button. It is the same task Home shows first.
 */
export function NowAnswer({ view, onClose }: { view: GuideView; onClose: () => void }) {
  const task = nowTask(view)
  return (
    <Dialog title={t('stanley.sheet.title')} onClose={onClose} header={(titleId) => <Header titleId={titleId} onClose={onClose} />}>
      <div className="stanley-answer">
        <p className="stanley-answer__q">{t('help.now')}</p>
        {task ? (
          <>
            <p><strong>{taskWords(task).title}</strong></p>
            <p>{taskWords(task).why}</p>
            <p className="muted">{taskMeta(task).join(' · ')}</p>
            <div className="button-row">
              <TaskDoIt task={task} where="asked" />
              <LinkButton to={task.to} state={openedFrom('blue', task.id)} onClick={onClose}>{t('guide.start')}</LinkButton>
              <Link to="/" onClick={onClose}>{t('guide.next.home')}</Link>
            </div>
          </>
        ) : <p>{t('guide.ahead')}</p>}
      </div>
    </Dialog>
  )
}

/** "Help me with this" on a task: Stanley's own notes for the screen the task opens, as questions that open their answers. Nothing is drawn when there are none. */
export function TaskHelp({ task, view, onAsk, compact }: { task: GuideTask; view: GuideView; onAsk?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [entry, setEntry] = useState<LibraryEntry | null>(null)
  const screen = helpScreenId(task)
  const entries = screen ? chipsFor(screen, view.stage, 6) : []
  if (entries.length === 0) return null
  const title = taskWords(task).title
  const close = () => { setOpen(false); setEntry(null) }
  return (
    <>
      {compact
        ? <GuideIconButton icon={Help} label={t('guide.help')} describedAs={t('guide.help.for', { task: title })} onClick={() => setOpen(true)} />
        : <Button variant="secondary" onClick={() => setOpen(true)} aria-label={t('guide.help.for', { task: title })}>{t('guide.help')}</Button>}
      {open && !entry && (
        <Dialog title={t('stanley.sheet.title')} onClose={close} header={(titleId) => <Header titleId={titleId} onClose={close} />}>
          <div className="stanley-answer">
            <p className="stanley-answer__q">{t('guide.help.intro', { task: title })}</p>
            <ul className="stanley-chips__list">
              {entries.map((e) => <li key={e.id}><button type="button" className="chip-q" onClick={() => setEntry(e)}>{questionOf(e)}</button></li>)}
            </ul>
          </div>
        </Dialog>
      )}
      {open && entry && <StanleyAnswer entry={entry} onClose={close} onAsk={() => { close(); onAsk?.() }} />}
    </>
  )
}

/** The time when a calendar file is made, read at the click and never during a render. */
const clockNow = (): number => Date.now()

/** "Add to calendar" on a task with a date: a calendar file made on the phone for the day it opens or is due. Nothing is sent anywhere, and a task with no date draws nothing. */
export function TaskCalendar({ task, compact }: { task: GuideTask; compact?: boolean }) {
  const w = taskWords(task)
  if (taskCalendarFile(task, w.title, w.why, 0) === null) return null
  const make = () => taskCalendarFile(task, w.title, w.why, clockNow()) ?? ''
  if (compact) return <GuideIconButton icon={CalendarPlus} label={t('guide.calendar')} describedAs={t('guide.calendar.for', { task: w.title })} onClick={() => downloadText(`${task.id}.ics`, 'text/calendar', make())} />
  return <CalendarButton variant="tertiary" name={`${task.id}.ics`} label={t('guide.calendar.for', { task: w.title })} make={make} />
}

/** "Remind me" on a task with a date: asks the server for a preview of a 09:00 reminder the day before (or the day a waiting task opens). Nothing is set until the card is confirmed. */
export function TaskRemind({ task, compact }: { task: GuideTask; compact?: boolean }) {
  const [prepared, setPrepared] = useState<StanleyAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const day = remindDay(task, isoDay(demoNow()))
  if (!day) return null
  const title = taskWords(task).title
  const ask = async () => {
    setBusy(true); setFailed(false)
    try {
      const a = normalizeAction(await stanleyActions.prepare({ kind: 'remind_me', args: taskRemindArgs(day, title) }))
      setPrepared(a)
      setFailed(a === null)
    } catch { setFailed(true) }
    setBusy(false)
  }
  return (
    <span className="remind-me">
      {prepared === null && (compact
        ? <GuideIconButton icon={Bell} label={t('remindMe.button')} describedAs={t('remindMe.aria', { title })} disabled={busy} onClick={() => { void ask() }} />
        : <Button variant="tertiary" disabled={busy} aria-label={t('remindMe.aria', { title })} onClick={() => { void ask() }}>{t('remindMe.button')}</Button>)}
      {failed && <span role="alert" className="field__error"> {t('remindMe.failed')}</span>}
      {prepared && <span role="status" className="remind-me__card"><StanleyActionCard action={prepared} onChange={setPrepared} /></span>}
    </span>
  )
}

/**
 * "Do it for me" on a task the server says Stanley can do (today: filling in the parts of check-in he can from what the app already holds). It asks the server for a preview and shows the card:
 * exactly what he would do and what he leaves alone, and nothing happens until the guest presses Confirm. He offers it at Helpful and Chatty, and on request at Asked (see `doItFor`).
 */
export function TaskDoIt({ task, where }: { task: GuideTask; where: 'home' | 'asked' }) {
  const [settings] = useSettings()
  const [prepared, setPrepared] = useState<StanleyAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const kind = doItFor(task, stanleyLevelFor(settings), where)
  if (!kind) return null
  const title = taskWords(task).title
  const ask = async (args: Record<string, string> = doItArgs(kind, task.id)) => {
    setBusy(true); setFailed(false)
    try {
      const a = normalizeAction(await stanleyActions.prepare({ kind, args }))
      setPrepared(a)
      setFailed(a === null)
    } catch { setFailed(true) }
    setBusy(false)
  }
  return (
    <span className="remind-me">
      {prepared === null && <Button variant="secondary" disabled={busy} aria-label={t('guide.doIt.aria', { task: title })} onClick={() => { void ask() }}>{t('guide.doIt')}</Button>}
      {failed && <span role="alert" className="field__error"> {t('guide.doIt.failed')}</span>}
      {prepared && <span role="status" className="remind-me__card"><StanleyActionCard action={prepared} onChange={setPrepared} /></span>}
      {prepared?.status === 'prepared' && prepared.kind === 'excursion_plan' && tourChoices(prepared.params).map((c) => (
        <Button key={c.id} variant="tertiary" disabled={busy} onClick={() => { void ask({ ...doItArgs(kind, task.id), excursionId: c.id }) }}>{t('guide.doIt.tourInstead', { name: c.name })}</Button>
      ))}
    </span>
  )
}
