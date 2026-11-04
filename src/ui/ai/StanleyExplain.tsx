import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { explanationOf, termOf, type TermId } from '../../ai/stanleyTerms'
import { useSettings } from '../../hooks/useSettings'
import { t } from '../../i18n'
import { stanleyLevelFor } from '../../settings/settings'
import { Dialog } from '../Dialog'

/**
 * A small "?" next to a hard word or number that opens a one-line plain explanation (docs/experience-extension-ideas.md 13.2, component 6). The words are authored,
 * so it costs nothing. It is a button the guest presses, so it shows at every level except Off.
 */
export function StanleyExplain({ term, labelled = false }: { term: TermId; labelled?: boolean }) {
  const [settings] = useSettings()
  const [open, setOpen] = useState(false)
  if (stanleyLevelFor(settings) === 'off') return null
  const name = termOf(term)
  return (
    <>
      <button type="button" className={`explain-btn${labelled ? ' explain-btn--text' : ''}`} aria-label={t('stanley.explain.button', { term: name })} onClick={() => setOpen(true)}>
        {labelled && <span aria-hidden="true">{name}</span>}
        <HelpCircle size={16} aria-hidden="true" />
      </button>
      {open && (
        <Dialog title={name} onClose={() => setOpen(false)}>
          <p className="muted">{t('stanley.explain.title')}</p>
          <p>{explanationOf(term)}</p>
        </Dialog>
      )}
    </>
  )
}
