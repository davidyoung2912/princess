import type { ReactNode } from 'react'
import type { StepContext, Draft } from '../../domain/booking'

export interface StepProps {
  draft: Draft
  update: (change: (d: Draft) => Draft) => void
  /** The problem text for a field, shown after a failed Continue; undefined when fine. */
  error: (path: string) => string | undefined
  ctx: StepContext
}

/** A heading and its content for a step. */
export function StepSection({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="step-h">
      <h2 id="step-h" tabIndex={-1}>{title}</h2>
      {intro && <p>{intro}</p>}
      {children}
    </section>
  )
}
