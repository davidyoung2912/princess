import { useEffect, useId, useRef, useState } from 'react'
import { t } from '../i18n'
import { Ask } from './icons'

interface HelpTipProps {
  /** The name of the field or choice the tip explains; it makes the button's name specific ("About Date of birth"). */
  about: string
  /** The short explanation. */
  children: string
}

/**
 * A small "?" button beside a field or choice. Pressing it opens a short note below, pressing it again, pressing
 * Escape, or tapping elsewhere closes it. It is a toggle rather than a hover tip, so it works the same by touch,
 * mouse, keyboard and screen reader. Escape closes only the note, never a dialog the field sits in.
 */
export function HelpTip({ about, children }: HelpTipProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const root = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    // On the window in the capture phase, so it runs before a dialog's own Escape handler and keeps the dialog open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      button.current?.focus({ preventScroll: true })
    }
    const onPointer = (e: Event) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])
  return (
    <span ref={root} className="helptip">
      <button
        ref={button}
        type="button"
        className="helptip__btn"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t('helptip.about', { label: about })}
        onClick={() => setOpen((o) => !o)}
      >
        <Ask aria-hidden="true" />
      </button>
      {open && <span id={panelId} className="helptip__note" role="note">{children}</span>}
    </span>
  )
}
