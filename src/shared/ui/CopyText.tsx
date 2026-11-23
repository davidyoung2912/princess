import { useState } from 'react'
import { t } from '../i18n'
import { Button } from './Button'

/** A short text the guest can copy and send themselves (nothing is sent from here). */
export function CopyText({ text, label }: { text: string; label?: string }) {
  const [note, setNote] = useState('')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setNote(t('dl.copied'))
    } catch {
      setNote(t('dl.copyFailed'))
    }
  }
  return (
    <div>
      <p className="copy-text">{text}</p>
      <div className="button-row">
        <Button variant="secondary" onClick={() => void copy()}>{label ?? t('dl.copy')}</Button>
      </div>
      <p className="muted" role="status">{note}</p>
    </div>
  )
}
