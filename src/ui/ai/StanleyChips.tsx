import { useState } from 'react'
import { Link } from 'react-router'
import { CircleDot } from 'lucide-react'
import { SCREEN_BY_ID } from '../../routes/screens'
import { SCREEN_ICONS } from '../screenIcons'
import stanley from '../../assets/stanley-small.png'
import { rateAnswer } from '../../ai/stanleyFeedback'
import { answerOf, chipsFor, questionOf, type LibraryEntry } from '../../ai/stanleyLibrary'
import type { JourneyStage } from '../../routes/hubs'
import { stanleyLevelFor } from '../../settings/settings'
import { t, th } from '../../i18n'
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
  const rate = (helpful: boolean) => {
    rateAnswer(entry.id, helpful)
    setRated(true)
  }
  return (
    <Dialog title={t('stanley.sheet.title')} onClose={onClose}>
      <div className="stanley-answer">
        <img className="stanley-answer__face" src={stanley} alt="" width="192" height="192" />
        <div>
          <p className="stanley-answer__q">{questionOf(entry)}</p>
          <p>{answerOf(entry)}</p>
          {entry.link && <p><Link to={entry.link} onClick={onClose}>{t('stanley.chips.show')}</Link></p>}
          <RelatedPages ids={entry.related} onClose={onClose} />
          {rated
            ? <p role="status" className="muted">{t('stanley.sheet.thanks')}</p>
            : (
              <div className="stanley-answer__rate" role="group" aria-label={t('stanley.sheet.helpful')}>
                <span>{t('stanley.sheet.helpful')}</span>
                <Button variant="secondary" onClick={() => rate(true)}>{t('stanley.sheet.yes')}</Button>
                <Button variant="secondary" onClick={() => rate(false)}>{t('stanley.sheet.no')}</Button>
              </div>
            )}
          <p><button type="button" className="link-button" onClick={onAsk}>{t('stanley.chips.more')}</button></p>
        </div>
      </div>
    </Dialog>
  )
}

/** "Related pages": where else in the app to read more. Screens that need an id in their address, or are not known, are left out. */
function RelatedPages({ ids, onClose }: { ids: readonly string[] | undefined; onClose: () => void }) {
  const screens = (ids ?? []).flatMap((id) => { const s = SCREEN_BY_ID.get(id); return s && !s.path.includes(':') ? [s] : [] })
  if (screens.length === 0) return null
  return (
    <div className="stanley-answer__related">
      <p className="stanley-answer__related-title">{t('stanley.sheet.related')}</p>
      <ul className="link-list stanley-answer__links">
        {screens.map((s) => {
          const Icon = SCREEN_ICONS[s.id] ?? CircleDot
          return <li key={s.id}><Link to={s.path} onClick={onClose}><Icon className="screen-list__icon" size={20} aria-hidden="true" />{th(s.titleKey)}</Link></li>
        })}
      </ul>
    </div>
  )
}
