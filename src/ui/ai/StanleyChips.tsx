import { useState } from 'react'
import { Link } from 'react-router'
import { CircleDot } from 'lucide-react'
import { SCREEN_BY_ID } from '../../routes/screens'
import { SCREEN_ICONS } from '../screenIcons'
import stanley from '../../assets/stanley-small.png'
import { answerOf, chipsFor, questionOf, type LibraryEntry } from '../../ai/stanleyLibrary'
import type { JourneyStage } from '../../routes/hubs'
import { stanleyLevelFor } from '../../settings/settings'
import { t, th } from '../../i18n'
import { useSettings } from '../../hooks/useSettings'
import { Dialog } from '../Dialog'
import { DialogHeader } from '../DialogHeader'

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
      <div className="stanley-card">
        <div className="stanley-card__head">
          <img className="stanley-card__face" src={stanley} alt="" width="192" height="192" />
          <h2 id="stanley-chips-h" className="stanley-card__title">{t('stanley.chips.intro')}</h2>
        </div>
        <ul className="stanley-chips__list" aria-label={t('stanley.chips.label')}>
          {chips.map((e) => <li key={e.id}><button type="button" className="chip-q" onClick={() => setOpen(e)}>{questionOf(e)}</button></li>)}
          <li><button type="button" className="chip-q chip-q--more" onClick={onAsk}>{t('stanley.chips.more')}</button></li>
        </ul>
      </div>
      {open && <StanleyAnswer entry={open} onClose={() => setOpen(null)} onAsk={() => { setOpen(null); onAsk() }} />}
    </aside>
  )
}

/** The bottom sheet that answers a chip: the question, the authored words, a link when there is one. */
export function StanleyAnswer({ entry, onClose, onAsk }: { entry: LibraryEntry; onClose: () => void; onAsk: () => void }) {
  return (
    <Dialog title={t('stanley.sheet.title')} onClose={onClose} header={(titleId) => (
      <DialogHeader titleId={titleId} title={t('stanley.sheet.title')} subtext={t('stanley.sheet.sub')} onClose={onClose}
        image={<img className="stanley__avatar" src={stanley} alt="" width="192" height="192" />} />
    )}>
      <div className="stanley-answer">
        <p className="stanley-answer__q">{questionOf(entry)}</p>
        <p>{answerOf(entry)}</p>
        {entry.link && <p><Link to={entry.link} onClick={onClose}>{t('stanley.chips.show')}</Link></p>}
        <RelatedPages ids={entry.related} onClose={onClose} />
        <p><button type="button" className="link-button" onClick={onAsk}>{t('stanley.chips.more')}</button></p>
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
