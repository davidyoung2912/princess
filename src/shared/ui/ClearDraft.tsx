import { Eraser } from 'lucide-react'
import { t } from '../i18n'
import { Button } from './Button'

/** "Clear" under a message box: empties what has been written (and anything attached) so the guest can start again. Shown only while there is something to clear. */
export function ClearDraft({ show, onClear, disabled }: { show: boolean; onClear: () => void; disabled?: boolean }) {
  if (!show) return null
  return (
    <div className="composer__clear">
      <Button type="button" variant="secondary" icon={Eraser} disabled={disabled} onClick={onClear}>{t('composer.clear')}</Button>
    </div>
  )
}
