import { useState } from 'react'
import { dishKey } from '../../domain/explorer/shortlist'
import { usePins } from '../../hooks/usePins'
import { t } from '../../i18n'
import { Bookmark, BookmarkCheck } from '../icons'

/** Saves a dish to remember (never to order it): a small toggle beside the dish, with the result spoken in a polite live region and a full list saying so. */
export function DishSaveButton({ shipId, venueId, name }: { shipId: string; venueId: string; name: string }) {
  const pins = usePins()
  const [message, setMessage] = useState('')
  const key = dishKey(shipId, venueId, name)
  const saved = pins.keys.includes(key)
  const Icon = saved ? BookmarkCheck : Bookmark
  const tap = async () => {
    const r = await pins.toggleSaved(key)
    setMessage(r === 'full' ? t('dish.full') : r === 'failed' ? t('dish.failed') : r === 'saved' ? t('dish.on', { title: name }) : t('dish.off', { title: name }))
  }
  return (
    <>
      <button type="button" className="dish-save" disabled={!pins.ready} aria-pressed={saved} aria-label={t('dish.save', { title: name })} title={t('dish.save', { title: name })} onClick={() => void tap()}>
        <Icon aria-hidden="true" focusable="false" />
      </button>
      <span className="visually-hidden" role="status">{message}</span>
    </>
  )
}
