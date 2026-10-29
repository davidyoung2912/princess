import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { t } from '../i18n'
import { useDialog } from '../hooks/useDialog'

interface DialogProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * A modal dialog that is a bottom sheet on a phone and a centred panel on larger screens. Focus moves in and is
 * trapped, Escape and the Close button both close it, and focus returns to what opened it (see useDialog).
 * It always has a Close button, so closing never depends on a drag gesture (WCAG 2.5.7). Tapping outside does not
 * close it: a stray tap should not throw away what someone was doing.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const ref = useDialog<HTMLDivElement>(onClose)
  const titleId = useId()
  return createPortal(
    <div className="dialog-backdrop">
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="dialog__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
