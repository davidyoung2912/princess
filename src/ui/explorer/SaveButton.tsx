import { useState } from 'react'
import { usePins } from '../../hooks/usePins'
import { t } from '../../i18n'
import { Button } from '../Button'

/** Saves a treatment or tour to the shortlist (or takes it off). Saving books nothing. The result is spoken in a polite live region, and a full list says so rather than dropping one. */
export function SaveButton({ itemKey, title }: { itemKey: string; title: string }) {
  const pins = usePins()
  const [message, setMessage] = useState('')
  const saved = pins.keys.includes(itemKey)
  const tap = async () => {
    const r = await pins.toggleSaved(itemKey)
    setMessage(r === 'full' ? t('short.full') : r === 'failed' ? t('short.failed') : r === 'saved' ? t('short.on', { title }) : t('short.off', { title }))
  }
  return (
    <>
      <Button variant="secondary" disabled={!pins.ready} aria-pressed={saved} onClick={() => void tap()}>
        {t('short.save', { title: '' }).trim()}<span className="visually-hidden"> {title}</span>
      </Button>
      <span className="visually-hidden" role="status">{message}</span>
    </>
  )
}
