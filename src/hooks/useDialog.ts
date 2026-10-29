import { useEffect, useRef, type RefObject } from 'react'
import { useLatest } from './useLatest'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** The open dialogs, innermost last; only the last one answers keys. */
const open: HTMLElement[] = []

/**
 * Makes an element behave as a modal dialog: focus moves into it when it opens (to its `[autofocus]` control, else
 * the first control), Tab stays inside it, Escape calls `onClose` when given, and focus returns to what had it before.
 */
export function useDialog<T extends HTMLElement>(onClose?: () => void): RefObject<T | null> {
  const ref = useRef<T>(null)
  const close = useLatest(() => onClose?.())
  const hasClose = !!onClose
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const items = () => [...box.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!box.contains(document.activeElement)) (items()[0] ?? box).focus({ preventScroll: true })
    open.push(box)
    const onKey = (e: KeyboardEvent) => {
      if (open[open.length - 1] !== box) return
      if (e.key === 'Escape' && hasClose) {
        e.preventDefault()
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab') {
        const list = items()
        if (list.length === 0) { e.preventDefault(); return }
        const first = list[0]
        const last = list[list.length - 1]
        if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus() }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      open.splice(open.indexOf(box), 1)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [close, hasClose])
  return ref
}
