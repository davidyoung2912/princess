import { ringFraction } from '../domain/homeLook'

/** A small ring showing how much of a checklist is done. Decoration beside words that already say "3 of 5", so it is hidden from screen readers. */
export function ProgressRing({ done, total, size = 28 }: { done: number; total: number; size?: number }) {
  const r = 11
  const c = 2 * Math.PI * r
  const f = ringFraction(done, total)
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <circle className="ring__track" cx="14" cy="14" r={r} fill="none" strokeWidth="4" />
      <circle className="ring__fill" cx="14" cy="14" r={r} fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${f * c} ${c}`} transform="rotate(-90 14 14)" />
    </svg>
  )
}
