import { useEffect, useRef, useState } from 'react'
import stanley from '../../assets/stanley-small.png'
import { advance, back, START, type AskValue } from '../../ai/stanleyAsk'
import { t } from '../../i18n'
import { Button } from '../Button'

export interface AskOption { value: string; label: string }
export interface AskItem {
  id: string
  prompt: string
  /** One line on why he asks. */
  why?: string
  multi?: boolean
  options: readonly AskOption[]
}

/**
 * Stanley asking one question at a time (SG2). A tap on an answer moves on; a "pick any" question has a Next button. Back is always there, and
 * "Show all questions" gives the guest the plain form instead. The caller owns the answers, so the form and the conversation always agree.
 */
export function StanleyAsk({ title, items, values, onChange, onDone, onShowAll }: {
  title: string
  items: readonly AskItem[]
  values: Readonly<Record<string, AskValue | undefined>>
  onChange: (id: string, value: AskValue) => void
  /** Called with the final answers, so a caller does not read stale state when the last tap finishes the conversation. */
  onDone: (values: Readonly<Record<string, AskValue | undefined>>) => void
  onShowAll: () => void
}) {
  const [at, setAt] = useState(START)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  const item = items[at.index]
  useEffect(() => { if (moved.current) heading.current?.focus(); moved.current = true }, [at.index])
  if (!item) return null
  const go = (final: Readonly<Record<string, AskValue | undefined>> = values) => {
    const next = advance(at, items.length)
    if (next.done) onDone(final)
    else setAt(next)
  }
  const current = values[item.id]
  const chosen = (v: string) => (Array.isArray(current) ? current.includes(v) : current === v)
  const pick = (v: string) => {
    if (item.multi) {
      const list = Array.isArray(current) ? current : []
      onChange(item.id, list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
    } else {
      onChange(item.id, v)
      go({ ...values, [item.id]: v })
    }
  }
  return (
    <section className="stanley-ask" aria-label={title}>
      <div className="stanley-ask__bubble">
        <img className="stanley-answer__face" src={stanley} alt="" width="192" height="192" />
        <div>
          <p className="muted stanley-ask__count">{t('stanley.ask.count', { n: at.index + 1, total: items.length })}</p>
          <h2 ref={heading} tabIndex={-1} className="stanley-ask__q">{item.prompt}</h2>
          {item.why && <p className="muted">{item.why}</p>}
        </div>
      </div>
      <div className="stanley-ask__options" role="group" aria-label={item.prompt}>
        {item.options.map((o) => (
          <button key={o.value} type="button" className="chip-q stanley-ask__opt" aria-pressed={chosen(o.value)} onClick={() => pick(o.value)}>{o.label}</button>
        ))}
      </div>
      <div className="button-row">
        {at.index > 0 && <Button variant="secondary" onClick={() => setAt(back(at))}>{t('stanley.ask.back')}</Button>}
        {item.multi && <Button onClick={() => go()}>{at.index + 1 >= items.length ? t('stanley.ask.finish') : t('stanley.ask.next')}</Button>}
        {!item.multi && <Button variant="secondary" onClick={() => go()}>{t('stanley.ask.skip')}</Button>}
        <Button variant="tertiary" onClick={onShowAll}>{t('stanley.ask.showAll')}</Button>
      </div>
    </section>
  )
}
