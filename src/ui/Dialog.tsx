import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, X } from 'lucide-react'
import { t, headingCase } from '../i18n'
import { useDialog } from '../hooks/useDialog'

interface DialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** A header of the screen's own in place of the title row and X (it must label the dialog with the id given and offer its own Close button). */
  header?: (titleId: string) => ReactNode
  /** Close with the same Back button the page header cards show, in place of the X. */
  backButton?: boolean
}

/**
 * A modal dialog: a centred panel at every screen size, scrolling inside if its content is taller than the screen. Focus moves in and is
 * trapped, Escape and the Close button both close it, and focus returns to what opened it (see useDialog).
 * It always has a Close button, so closing never depends on a drag gesture (WCAG 2.5.7). Tapping outside does not
 * close it: a stray tap should not throw away what someone was doing.
 */
export function Dialog({ title, onClose, children, header, backButton }: DialogProps) {
  const ref = useDialog<HTMLDivElement>(onClose)
  const titleId = useId()
  return createPortal(
    <div className="dialog-backdrop">
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        {header ? header(titleId) : (
          <div className="dialog__head">
            <h2 id={titleId}>{headingCase(title)}</h2>
            {backButton ? (
              <button type="button" className="page-header__back dialog__back" onClick={onClose}>
                <ArrowLeft aria-hidden="true" />
                <span>{t('shell.back')}</span>
              </button>
            ) : (
              <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
                <X aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
