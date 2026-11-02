import { useRef, useState } from 'react'
import { cardLayout, cardText, type Card as CardData } from '../../domain/export'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Download, Printer } from '../icons'
import { downloadText } from './cardTools'

/** A button that downloads a calendar file made on demand. */
export function CalendarButton({ name, make, label, variant = 'secondary' }: { name: string; make: () => string; label: string; variant?: 'secondary' | 'tertiary' }) {
  return <Button variant={variant} onClick={() => downloadText(name, 'text/calendar', make())}><Download aria-hidden="true" /> {label}</Button>
}

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

/** Draws the card (and the picked photo, if any) to a canvas: same layout as the printed card. High contrast, no tracking, nothing sent anywhere. */
function draw(canvas: HTMLCanvasElement, card: CardData, photo: HTMLImageElement | null): void {
  const layout = cardLayout(card, photo !== null)
  canvas.width = layout.width
  canvas.height = layout.height
  const g = canvas.getContext('2d')
  if (!g) return
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, layout.width, layout.height)
  g.fillStyle = '#0b2545'
  g.fillRect(0, 0, layout.width, 24)
  g.fillStyle = '#111111'
  g.textBaseline = 'alphabetic'
  for (const l of layout.lines) { g.font = `${l.weight} ${Math.round(l.size)}px ${FONT}`; g.fillText(l.text, 80, l.y) }
  if (photo && layout.photoY !== null) {
    const w = layout.width - 160
    const h = 560
    const r = Math.max(w / photo.width, h / photo.height)
    g.save()
    g.beginPath(); g.rect(80, layout.photoY, w, h); g.clip()
    g.drawImage(photo, 80 + (w - photo.width * r) / 2, layout.photoY + (h - photo.height * r) / 2, photo.width * r, photo.height * r)
    g.restore()
  }
}

/** A card as it prints, with buttons to print it, save it as an image, or copy its words. */
export function PrintCard({ card, photo = null, label }: { card: CardData; photo?: HTMLImageElement | null; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState('')
  const print = () => {
    document.body.dataset.printCard = card.id
    ref.current?.classList.add('print-card--active')
    const done = () => { delete document.body.dataset.printCard; ref.current?.classList.remove('print-card--active'); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
  }
  const save = () => {
    const canvas = document.createElement('canvas')
    draw(canvas, card, photo)
    canvas.toBlob((blob) => {
      if (!blob) { setNote(t('dl.card.imageFailed')); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${card.id}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  const copy = async () => { try { await navigator.clipboard.writeText(cardText(card)); setNote(t('dl.copied')) } catch { setNote(t('dl.copyFailed')) } }
  return (
    <section aria-label={label}>
      <div ref={ref} className={`print-card${card.large ? ' print-card--large' : ''}`}>
        <h3 className="print-card__title">{card.title}</h3>
        {card.subtitle && <p className="print-card__sub">{card.subtitle}</p>}
        {photo && <img className="print-card__photo" src={photo.src} alt={t('dl.card.photoAlt')} />}
        {card.lines.length > 0 && <ul className="print-card__lines">{card.lines.map((l, i) => <li key={`${i}-${l}`}>{l}</li>)}</ul>}
        {card.footer && <p className="print-card__foot">{card.footer}</p>}
      </div>
      <div className="button-row no-print">
        <Button variant="secondary" onClick={print}><Printer aria-hidden="true" /> {t('dl.card.print')}</Button>
        <Button variant="secondary" onClick={save}><Download aria-hidden="true" /> {t('dl.card.image')}</Button>
        <Button variant="tertiary" onClick={() => void copy()}>{t('dl.card.copy')}</Button>
      </div>
      <p className="muted no-print" role="status">{note}</p>
    </section>
  )
}
