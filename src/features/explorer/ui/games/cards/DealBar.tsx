import { useState } from 'react'
import { t } from '../../../../../shared/i18n'
import { Button } from '../../../../../shared/ui/Button'

/** The numbered-deal bar every card game shares: which deal this is, Replay it from the start, or go to any deal by number (to play the same deal as a friend). */
export function DealBar({ number, max, canReplay, onGo }: { number: number; max: number; canReplay: boolean; onGo: (n: number) => void }) {
  const [text, setText] = useState('')
  const parsed = Number(text)
  const valid = text !== '' && Number.isInteger(parsed) && parsed >= 1 && parsed <= max
  return (
    <div className="cg-deal" data-tour="cg-deal">
      <span className="cg-deal__no">{t('cg.deal', { n: number })}</span>
      <button type="button" className="sd-tool" onClick={() => onGo(number)} disabled={!canReplay}><span>{t('cg.replay')}</span></button>
      <form className="cg-deal__go" onSubmit={(e) => { e.preventDefault(); if (valid) { onGo(parsed); setText('') } }}>
        <label className="visually-hidden" htmlFor="cg-deal-input">{t('cg.goto', { max })}</label>
        <input id="cg-deal-input" className="cg-deal__input" type="number" inputMode="numeric" min={1} max={max} value={text} placeholder={t('cg.goto.ph')} onChange={(e) => setText(e.target.value)} />
        <Button variant="secondary" type="submit" disabled={!valid}>{t('cg.go')}</Button>
      </form>
    </div>
  )
}
