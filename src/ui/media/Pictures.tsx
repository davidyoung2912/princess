import { useId, useRef, useState } from 'react'
import { normalizeMedia, pickProblem, uploadErrorKey, type Media, type MediaPurpose } from '../../domain/media'
import { useMediaUrl } from '../../hooks/useMedia'
import { t, type StringKey } from '../../i18n'
import { shrinkPicture } from '../../media/shrink'
import { guestMedia } from '../../runtime'
import { Button } from '../Button'

/** A picture the guest kept, fetched with their sign-in (an image tag cannot send it). `alt` is what a screen reader says: the guest's caption, or a plain description. */
export function MediaImage({ media, alt }: { media: Pick<Media, 'id' | 'width' | 'height'>; alt: string }) {
  const { url, failed } = useMediaUrl(media.id)
  if (failed) return <p className="muted">{t('media.unavailable')}</p>
  if (!url) return <p className="muted" role="status">{t('media.loading')}</p>
  return <img className="guest-picture" src={url} alt={alt} width={media.width} height={media.height} loading="lazy" decoding="async" />
}

/**
 * Choose a picture, shrink it on the device and send it (N7.1). Says what happens to it before anything is sent, and why a picture was refused afterwards.
 * `needs` is anything the caller wants ticked or filled in first (a reason the button is off is always written next to it).
 */
export function PicturePicker({ purpose, reference, kind, caption, ready, blockedWhy, camera, onSaved }: {
  purpose: MediaPurpose
  reference: string
  kind?: string
  caption?: string
  /** False while the caller's own form is incomplete; `blockedWhy` says what is missing. */
  ready: boolean
  blockedWhy?: string
  /** Open the phone's back camera first (a lost item, a receipt); a laptop still shows the file chooser. */
  camera?: boolean
  onSaved: (saved: Media | null) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | { err: string }>('idle')
  const choose = async (file: File | undefined) => {
    if (!file) return
    const problem = pickProblem(file.type, file.size, caption ?? '', null)
    if (problem === 'type' || problem === 'caption') { setState({ err: problem }); return }
    setState('busy')
    try {
      const body = await shrinkPicture(file)
      const saved = normalizeMedia(await guestMedia.upload(body, { purpose, ref: reference, kind, caption: (caption ?? '').trim() }))
      setState('saved')
      onSaved(saved)
    } catch (e) {
      setState({ err: uploadErrorKey(e instanceof Error ? e.message : undefined) })
    }
    if (input.current) input.current.value = ''
  }
  return (
    <div className="field">
      <label htmlFor={id}>{t('media.choose')}</label>
      <p className="field__hint">{t('media.hint')}</p>
      <input ref={input} id={id} type="file" accept="image/jpeg,image/png" capture={camera ? 'environment' : undefined} disabled={!ready || state === 'busy'} aria-describedby={`${id}-state`} onChange={(e) => void choose(e.target.files?.[0])} />
      {!ready && blockedWhy && <p className="muted">{blockedWhy}</p>}
      <p id={`${id}-state`} role={typeof state === 'string' ? 'status' : 'alert'} className={typeof state === 'string' ? undefined : 'field__error'}>
        {state === 'busy' ? t('media.sending') : state === 'saved' ? t('media.saved') : state === 'idle' ? '' : t(`media.err.${state.err}` as StringKey)}
      </p>
    </div>
  )
}

/** A kept picture with the words that say what it is, and a way to delete it. */
export function KeptPicture({ media, alt, onDeleted, extra }: { media: Media; alt: string; onDeleted: () => void; extra?: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const remove = async () => {
    setBusy(true)
    try { await guestMedia.remove(media.id); onDeleted() } catch { setFailed(true); setBusy(false) }
  }
  return (
    <figure className="kept-picture">
      <MediaImage media={media} alt={alt} />
      <figcaption>
        {media.caption && <span>{media.caption} </span>}
        {extra && <span className="muted">{extra}</span>}
        {media.mine && <Button variant="tertiary" disabled={busy} onClick={() => void remove()}>{t('media.delete')}</Button>}
        {failed && <span className="field__error" role="alert">{t('media.err.other')}</span>}
      </figcaption>
    </figure>
  )
}
