import { useState, useSyncExternalStore } from 'react'
import { ArrowDown, ArrowUp, Pencil, X } from 'lucide-react'
import { getContext, subscribeContext } from '../account/context'
import { movePin } from '../domain/ease'
import { useSettings } from '../hooks/useSettings'
import { th, t } from '../i18n'
import { listedScreens } from '../routes/stageNav'
import { Button } from './Button'
import { Dialog } from './Dialog'

/** "Edit favourites": reorder or remove the pinned screens with buttons, so keyboard and switch users never need a drag or long-press. */
export function EditFavourites() {
  const [open, setOpen] = useState(false)
  const [{ pins }, update] = useSettings()
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  const items = listedScreens(pins, { sailingId: context?.focusSailingId ?? context?.sailingId ?? null, tripNumber: context?.booking?.number ?? null })
  const ids = items.map((x) => x.screen.id)
  const move = (id: string, delta: -1 | 1) => update({ pins: [...movePin(ids, id, delta), ...pins.filter((p) => !ids.includes(p))] })
  return (
    <>
      <button type="button" className="link-button shortcut-bar__edit" onClick={() => setOpen(true)}><Pencil size={14} aria-hidden="true" /> {t('favs.edit')}</button>
      {open && (
        <Dialog title={t('favs.title')} onClose={() => setOpen(false)}>
          <p className="muted">{t('favs.intro')}</p>
          {items.length === 0 ? <p>{t('favs.none')}</p> : (
            <ol className="favs">
              {items.map(({ screen }, i) => {
                const title = th(screen.titleKey)
                return (
                  <li key={screen.id}>
                    <span>{title}</span>
                    <button type="button" className="icon-btn" disabled={i === 0} aria-label={t('favs.up', { title })} onClick={() => move(screen.id, -1)}><ArrowUp aria-hidden="true" /></button>
                    <button type="button" className="icon-btn" disabled={i === items.length - 1} aria-label={t('favs.down', { title })} onClick={() => move(screen.id, 1)}><ArrowDown aria-hidden="true" /></button>
                    <button type="button" className="icon-btn" aria-label={t('favs.remove', { title })} onClick={() => update({ pins: pins.filter((p) => p !== screen.id) })}><X aria-hidden="true" /></button>
                  </li>
                )
              })}
            </ol>
          )}
          <Button block onClick={() => setOpen(false)}>{t('favs.done')}</Button>
        </Dialog>
      )}
    </>
  )
}
