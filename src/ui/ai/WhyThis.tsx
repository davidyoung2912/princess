import { useState } from 'react'
import { Info } from 'lucide-react'
import { whyCard, type WhyKind } from '../../ai/stanleyCard'
import { t } from '../../i18n'
import { Dialog } from '../Dialog'
import { StanleyAnswerCard } from './StanleyAnswerCard'

/**
 * "Why am I seeing this?": a small button on a suggestion, tip or chip that opens the fact and the rule behind it in the same card as an answer. It is a provenance
 * explainer, not an AI label. `fact` is a sentence fragment saying what the app knew.
 */
export function WhyThis({ kind, fact, what }: { kind: WhyKind; fact: string; what: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="why-btn" aria-label={`${t('stanley.why.button')} ${what}`} title={t('stanley.why.button')} onClick={() => setOpen(true)}>
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <Dialog title={t('stanley.why.title')} onClose={() => setOpen(false)}>
          <StanleyAnswerCard card={whyCard(kind, fact)} onNavigate={() => setOpen(false)} />
        </Dialog>
      )}
    </>
  )
}
