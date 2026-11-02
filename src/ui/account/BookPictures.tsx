import { bookPhotos, type Media } from '../../domain/media'
import { t } from '../../i18n'
import { KeptPicture, MediaImage, PicturePicker } from '../media/Pictures'

const altFor = (m: Media, day: number | 'cover'): string => m.caption || (day === 'cover' ? t('media.book.coverAlt') : t('media.book.alt', { day }))

/** Adding and removing the pictures that go on one day of the memory book (N7.3), or on its front page. They stay on the server for the guest only. */
export function DayPictureEditor({ day, list, onChange }: { day: number | 'cover'; list: readonly Media[]; onChange: () => void }) {
  const mine = bookPhotos(list, day)
  return (
    <details>
      <summary>{day === 'cover' ? t('media.book.cover') : t('media.book.add', { day })}{mine.length > 0 ? ` (${mine.length})` : ''}</summary>
      {mine.map((m) => <KeptPicture key={m.id} media={m} alt={altFor(m, day)} onDeleted={onChange} />)}
      <PicturePicker purpose="book" reference={String(day)} ready onSaved={onChange} />
    </details>
  )
}

/** The pictures on a page of the book itself. They print with it. */
export function BookPagePictures({ day, list }: { day: number | 'cover'; list: readonly Media[] }) {
  const pictures = bookPhotos(list, day)
  if (pictures.length === 0) return null
  return (
    <div className="book-pictures">
      {pictures.map((m) => <figure key={m.id}><MediaImage media={m} alt={altFor(m, day)} />{m.caption && <figcaption>{m.caption}</figcaption>}</figure>)}
    </div>
  )
}
