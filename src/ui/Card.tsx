import type { ReactNode } from 'react'

interface CardProps {
  /** Id of the heading inside, so the card is a labelled region. */
  labelledBy?: string
  /** Large rounded top-left corner, like princess.com hero sections. */
  hero?: boolean
  info?: boolean
  children: ReactNode
}

export function Card({ labelledBy, hero, info, children }: CardProps) {
  const cls = ['card', hero ? 'card--hero' : '', info ? 'card--info' : ''].filter(Boolean).join(' ')
  return labelledBy ? <section className={cls} aria-labelledby={labelledBy}>{children}</section> : <div className={cls}>{children}</div>
}
