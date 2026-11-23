import type { ComponentType, ReactNode } from 'react'
import { headingCase, t } from '../i18n'
import { X } from './icons'

interface DialogHeaderProps {
  /** The id the dialog is labelled by (the one `Dialog`'s `header` gives). */
  titleId: string
  title: string
  subtext?: string
  /** A line icon, or a picture (a round avatar) in `image`. */
  icon?: ComponentType<{ 'aria-hidden'?: boolean | 'true' | 'false'; className?: string }>
  image?: ReactNode
  onClose: () => void
}

/** The header card of a dialog, the same as a page's: icon, title, a line of subtext and a Close button in the Back button's style (no X). Pass it to `Dialog`'s `header`. */
export function DialogHeader({ titleId, title, subtext, icon: Icon, image, onClose }: DialogHeaderProps) {
  return (
    <header className="page-header dialog-header">
      <div className="page-header__row">
        {image ?? (Icon && <Icon aria-hidden="true" className="page-header__icon" />)}
        <h2 id={titleId} className="page-header__title">{headingCase(title)}</h2>
      </div>
      {subtext && <p className="page-header__subtext">{subtext}</p>}
      <button type="button" className="page-header__back" onClick={onClose}>
        <X aria-hidden="true" />
        <span>{t('common.close')}</span>
      </button>
    </header>
  )
}
