import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../api/chatTypes'
import { galleryOf, gridColumns, photoCountOf, stepIndex, swipeDelta, type GalleryPhoto } from '../../domain/chatPhotos'
import { useSettings } from '../../hooks/useSettings'
import { api } from '../../runtime'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { useShipTime } from './shipTime'

/** A photo is not in the thread page (it is large); each is fetched once and kept for the life of the page. */
const photos = new Map<string, Promise<string>>()
const photoFor = (conversationId: string, messageId: string, index: number): Promise<string> => {
  const key = `${messageId}:${index}`
  let p = photos.get(key)
  if (!p) {
    p = api.chatConversations.photo(conversationId, messageId, index)
    photos.set(key, p)
    // A failed fetch is forgotten so the next render can try again.
    p.catch(() => photos.delete(key))
  }
  return p
}

/** The photo as a data URL once it has arrived (`sent` is the one just sent from this device). `wanted` false fetches nothing. A change of photo starts again. */
function usePhoto(conversationId: string, messageId: string, index: number, wanted: boolean, sent?: string): { src?: string; failed: boolean } {
  const key = `${messageId}:${index}`
  const [got, setGot] = useState<{ key: string; src?: string; failed: boolean } | null>(null)
  const mine = got?.key === key ? got : null
  const src = mine?.src ?? sent
  useEffect(() => {
    if (!wanted || src) return
    let live = true
    photoFor(conversationId, messageId, index).then((url) => { if (live) setGot({ key, src: url, failed: false }) }, () => { if (live) setGot({ key, failed: true }) })
    return () => { live = false }
  }, [wanted, src, key, conversationId, messageId, index])
  return { src, failed: mine?.failed === true }
}

const photoAlt = (name: string, index: number, count: number): string =>
  count > 1 ? t('cphoto.altOf', { name, n: index + 1, count }) : t('chat.photoAlt', { name })

/** One photo in a grid: a button that opens the viewer. */
function Thumb({ conversationId, messageId, index, count, name, sent, wanted, onOpen, className }: {
  conversationId: string; messageId: string; index: number; count: number; name: string; sent?: string; wanted: boolean; onOpen: () => void; className?: string
}) {
  const { src, failed } = usePhoto(conversationId, messageId, index, wanted, sent)
  const alt = photoAlt(name, index, count)
  if (failed) return <p className="muted" role="status">{t('cphoto.failed')}</p>
  if (!src) return <p className="muted" role="status">{t('account.loading')}</p>
  return (
    <button type="button" className={`chat-photo-btn ${className ?? ''}`} onClick={onOpen} aria-label={t('cphoto.open', { alt })}>
      <img className="chat-photo-img" src={src} alt="" loading="lazy" decoding="async" />
    </button>
  )
}

/** The full-screen viewer: one photo, Previous and Next (also the arrow keys and a swipe), a count for screen readers, and Close (Escape) from the dialog. */
function Viewer({ conversationId, items, start, onClose }: { conversationId: string; items: GalleryPhoto[]; start: number; onClose: () => void }) {
  const [at, setAt] = useState(start)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const item = items[at]
  const { src, failed } = usePhoto(conversationId, item.messageId, item.index, true)
  const shipTime = useShipTime()
  const go = (delta: number) => setAt((i) => stepIndex(i, items.length, delta))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); setAt((i) => stepIndex(i, items.length, -1)) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setAt((i) => stepIndex(i, items.length, 1)) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [items.length])
  const alt = photoAlt(item.fromName, item.index, item.count)
  return (
    <Dialog title={t('cphoto.viewer')} onClose={onClose}>
      <div
        className="chat-viewer"
        onTouchStart={(e) => { const p = e.touches[0]; touch.current = p ? { x: p.clientX, y: p.clientY } : null }}
        onTouchEnd={(e) => {
          const from = touch.current
          const p = e.changedTouches[0]
          touch.current = null
          if (from && p) go(swipeDelta(p.clientX - from.x, p.clientY - from.y))
        }}
      >
        {failed ? <p role="alert" className="field__error">{t('cphoto.failed')}</p> : src ? <img className="chat-viewer__img" src={src} alt={alt} /> : <p className="muted" role="status">{t('account.loading')}</p>}
        <p className="muted" role="status">{t('cphoto.position', { n: at + 1, count: items.length, name: item.fromName, time: shipTime(item.at) })}</p>
        {items.length > 1 && (
          <div className="button-row">
            <Button variant="secondary" disabled={at === 0} onClick={() => go(-1)}>{t('cphoto.prev')}</Button>
            <Button variant="secondary" disabled={at === items.length - 1} onClick={() => go(1)}>{t('cphoto.next')}</Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}

/** The photos of one message, as a grid that opens the viewer at the one tapped. In data-light mode nothing is fetched until the guest asks (once for the whole message). */
export function MessagePhotos({ conversationId, message, name, you }: { conversationId: string; message: ChatMessage; name: string; you: string }) {
  const [settings] = useSettings()
  const [asked, setAsked] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const count = photoCountOf(message)
  if (count === 0) return null
  const wanted = !settings.dataLight || asked
  if (!wanted) return <Button variant="secondary" onClick={() => setAsked(true)}>{t(count > 1 ? 'cphoto.showMany' : 'img.show', { name, count })}</Button>
  const items = galleryOf([message], you).sort((a, b) => a.index - b.index)
  return (
    <>
      <div className={`chat-photo-grid chat-photo-grid--${gridColumns(count)}`}>
        {items.map((g) => (
          <Thumb key={g.index} conversationId={conversationId} messageId={message.id} index={g.index} count={count} name={name} sent={g.index === 0 ? message.photo : undefined} wanted onOpen={() => setViewing(g.index)} />
        ))}
      </div>
      {viewing !== null && <Viewer conversationId={conversationId} items={items} start={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

const PAGE = 12

/** "Photos in this chat": every photo in the messages this screen holds, newest first, twelve at a time. Older ones come in as the thread is scrolled back. */
export function PhotosGallery({ conversationId, messages, you }: { conversationId: string; messages: readonly ChatMessage[]; you: string }) {
  const [settings] = useSettings()
  const [shown, setShown] = useState(PAGE)
  const [viewing, setViewing] = useState<number | null>(null)
  const shipTime = useShipTime()
  const all = galleryOf(messages, you)
  if (all.length === 0) return <p className="muted">{t('cphoto.none')}</p>
  return (
    <>
      <p className="muted">{t('cphoto.count', { count: all.length })}</p>
      <ul className="chat-photo-grid chat-photo-grid--3 plain-bullets">
        {all.slice(0, shown).map((g, i) => (
          <li key={`${g.messageId}:${g.index}`}>
            {settings.dataLight
              ? <Button variant="secondary" onClick={() => setViewing(i)}>{t('cphoto.openText', { name: g.fromName, time: shipTime(g.at) })}</Button>
              : <Thumb conversationId={conversationId} messageId={g.messageId} index={g.index} count={g.count} name={g.fromName} wanted onOpen={() => setViewing(i)} />}
          </li>
        ))}
      </ul>
      {shown < all.length && <div className="button-row"><Button variant="secondary" onClick={() => setShown(shown + PAGE)}>{t('cphoto.more')}</Button></div>}
      <p className="muted">{t('cphoto.older')}</p>
      {viewing !== null && <Viewer conversationId={conversationId} items={all} start={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
