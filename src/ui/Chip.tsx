import type { ReactNode } from 'react'
import { Check } from './icons'

interface ChipProps {
  pressed: boolean
  onToggle: () => void
  children: ReactNode
}

/** A filter toggle: `aria-pressed` plus a check mark when on, so state is not colour alone. */
export function Chip({ pressed, onToggle, children }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onToggle}>
      {pressed && <Check aria-hidden="true" />}
      {children}
    </button>
  )
}
