import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import type { PoseId } from '../art/manifest'
import { SHOW_ME_STEPS, type ShowMeId } from '../domain/ease'
import { t, type StringKey } from '../i18n'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { StanleyPose } from './StanleyPose'

const POSES_FOR: Record<ShowMeId, readonly [PoseId, PoseId, PoseId]> = {
  gangway: ['suitcase', 'point', 'thumbs'],
  muster: ['lifejacket', 'point', 'thumbs'],
  tender: ['binoculars', 'map', 'thumbs'],
}

/** An optional "Show me" button that opens three captioned steps, each with Stanley and the words. It never replaces the written instructions on the screen. */
export function ShowMe({ id }: { id: ShowMeId }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" className="no-print" onClick={() => setOpen(true)}><HelpCircle size={18} aria-hidden="true" /> {t('showme.button')}</Button>
      {open && (
        <Dialog title={t(`showme.${id}.title` as StringKey)} onClose={() => setOpen(false)}>
          <ol className="showme">
            {Array.from({ length: SHOW_ME_STEPS }, (_, i) => (
              <li key={i} className="showme__step">
                <StanleyPose pose={POSES_FOR[id][i]} size={80} />
                <p><strong>{t('showme.step', { n: i + 1 })}</strong> {t(`showme.${id}.${i + 1}` as StringKey)}</p>
              </li>
            ))}
          </ol>
          <Button block onClick={() => setOpen(false)}>{t('showme.done')}</Button>
        </Dialog>
      )}
    </>
  )
}
