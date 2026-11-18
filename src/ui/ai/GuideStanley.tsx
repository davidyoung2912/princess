import { useState } from 'react'
import { Link } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import { normalizeAction, type StanleyAction } from '../../ai/stanleyAction'
import { chipsFor, questionOf, type LibraryEntry } from '../../ai/stanleyLibrary'
import type { GuideTask, GuideView } from '../../api/guideTypes'
import { demoNow } from '../../demo/store'
import { isoDay } from '../../domain/rates'
import { helpScreenId, nowTask, remindDay, taskRemindArgs } from '../../guide/stanley'
import { taskMeta, taskWords } from '../../guide/words'
import { t } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { stanleyActions } from '../../runtime'
import { Button, LinkButton } from '../Button'
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
export function TaskHelp({ task, view, onAsk }: { task: GuideTask; view: GuideView; onAsk?: () => void }) {
  const [open, setOpen] = useState(false)
  const [entry, setEntry] = useState<LibraryEntry | null>(null)
  const screen = helpScreenId(task)
  const entries = screen ? chipsFor(screen, view.stage, 6) : []
  if (entries.length === 0) return null
  const title = taskWords(task).title
  const close = () => { setOpen(false); setEntry(null) }
  return (
    <>
      <Button variant="tertiary" onClick={() => setOpen(true)} aria-label={t('guide.help.for', { task: title })}>{t('guide.help')}</Button>
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

/** "Remind me" on a task with a date: asks the server for a preview of a 09:00 reminder the day before (or the day a waiting task opens). Nothing is set until the card is confirmed. */
export function TaskRemind({ task }: { task: GuideTask }) {
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
      {prepared === null && <Button variant="tertiary" disabled={busy} aria-label={t('remindMe.aria', { title })} onClick={() => { void ask() }}>{t('remindMe.button')}</Button>}
      {failed && <span role="alert" className="field__error"> {t('remindMe.failed')}</span>}
      {prepared && <span role="status" className="remind-me__card"><StanleyActionCard action={prepared} onChange={setPrepared} /></span>}
    </span>
  )
}
