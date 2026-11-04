import { useState } from 'react'
import { Link } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import { answerOf, chipsFor, questionOf, type LibraryEntry } from '../../ai/stanleyLibrary'
import type { JourneyStage } from '../../routes/hubs'
import { stanleyLevelFor } from '../../settings/settings'
import { t } from '../../i18n'
import { useSettings } from '../../hooks/useSettings'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

/**
 * Question chips at the foot of a page (docs/experience-extension-ideas.md 13.2). A tap opens the authored answer in a small sheet, which costs nothing:
 * no model is called. "Ask Stanley something else" opens the chat. Shown when Stanley's level is Helpful or Chatty and the stage has a library.
 */
export function StanleyChips({ screenId, stage, onAsk }: { screenId: string | undefined; stage: JourneyStage; onAsk: () => void }) {
  const [settings] = useSettings()
  const [open, setOpen] = useState<LibraryEntry | null>(null)
  const level = stanleyLevelFor(settings)
  if (level === 'asked' || level === 'off') return null
  const chips = chipsFor(screenId, stage)
  if (chips.length === 0) return null
  return (
    <aside className="page stanley-chips no-print" aria-labelledby="stanley-chips-h">
      <h2 id="stanley-chips-h" className="stanley-chips__title">{t('stanley.chips.intro')}</h2>
      <ul className="stanley-chips__list" aria-label={t('stanley.chips.label')}>
        {chips.map((e) => <li key={e.id}><button type="button" className="chip-q" onClick={() => setOpen(e)}>{questionOf(e)}</button></li>)}
        <li><button type="button" className="chip-q chip-q--more" onClick={onAsk}>{t('stanley.chips.more')}</button></li>
      </ul>
      {open && <StanleyAnswer entry={open} onClose={() => setOpen(null)} onAsk={() => { setOpen(null); onAsk() }} />}
    </aside>
  )
}

/** The bottom sheet that answers a chip: the question, the authored words, a link when there is one, and "Was that helpful?". */
export function StanleyAnswer({ entry, onClose, onAsk }: { entry: LibraryEntry; onClose: () => void; onAsk: () => void }) {
  const [rated, setRated] = useState(false)
  return (
    <Dialog title={t('stanley.sheet.title')} onClose={onClose}>
      <div className="stanley-answer">
        <img className="stanley-answer__face" src={stanley} alt="" width="192" height="192" />
        <div>
          <p className="stanley-answer__q">{questionOf(entry)}</p>
          <p>{answerOf(entry)}</p>
          {entry.link && <p><Link to={entry.link} onClick={onClose}>{t('stanley.chips.show')}</Link></p>}
          {rated
            ? <p role="status" className="muted">{t('stanley.sheet.thanks')}</p>
            : (
              <div className="stanley-answer__rate" role="group" aria-label={t('stanley.sheet.helpful')}>
                <span>{t('stanley.sheet.helpful')}</span>
                <Button variant="secondary" onClick={() => setRated(true)}>{t('stanley.sheet.yes')}</Button>
                <Button variant="secondary" onClick={() => setRated(true)}>{t('stanley.sheet.no')}</Button>
              </div>
            )}
          <p><button type="button" className="link-button" onClick={onAsk}>{t('stanley.chips.more')}</button></p>
        </div>
      </div>
    </Dialog>
  )
}
