import { useState } from 'react'
import { CABIN_KINDS, cabinPhotos, isCabinKind, type CabinKind } from '../../domain/media'
import { categoryById, type CategoryId } from '../../domain/ship'
import { useCabinMedia } from '../../hooks/useMedia'
import { t, th, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { Field } from '../Field'
import { KeptPicture, PicturePicker } from '../media/Pictures'

/**
 * Pictures of a stateroom type from guests who stayed in it (N7.2): the room, the view, something in the way, noise. A picture waits for review, and only the guest who sent it
 * sees it until it is approved. Whether other guests' approved pictures appear is the server's decision, and the words here do not promise it.
 */
export function CabinPhotos({ category }: { category: CategoryId }) {
  const room = categoryById(category)?.name ?? category
  const { list, failed, reload } = useCabinMedia(category)
  const [kind, setKind] = useState<CabinKind>('room')
  const [caption, setCaption] = useState('')
  const [stayed, setStayed] = useState(false)
  const shown = cabinPhotos(list, category)
  return (
    <Card labelledBy="cabin-photos">
      <h2 id="cabin-photos" className="card__title">{`${th('media.cabin.title')}: ${room}`}</h2>
      <p>{t('media.cabin.intro')}</p>
      {failed && <p className="muted">{t('media.unavailable')}</p>}
      {shown.length === 0 && !failed && <p>{t('media.cabin.none')}</p>}
      <ul className="plain-list">
        {shown.map((m) => (
          <li key={m.id}>
            <KeptPicture
              media={m}
              alt={m.caption || t('media.cabin.alt', { kind: isCabinKind(m.kind) ? t(`media.kind.${m.kind}` as StringKey) : '', room })}
              extra={`${isCabinKind(m.kind) ? t(`media.kind.${m.kind}` as StringKey) : ''}${m.mine ? ` · ${t(`media.cabin.status.${m.status}` as StringKey)}` : ''}`}
              onDeleted={reload}
            />
          </li>
        ))}
      </ul>
      <div className="field">
        <label htmlFor="cabin-photo-kind">{t('media.cabin.kind')}</label>
        <select id="cabin-photo-kind" value={kind} onChange={(e) => { if (isCabinKind(e.target.value)) setKind(e.target.value) }}>
          {CABIN_KINDS.map((k) => <option key={k} value={k}>{t(`media.kind.${k}` as StringKey)}</option>)}
        </select>
      </div>
      <Field label={t('media.cabin.caption')} value={caption} maxLength={140} onChange={(e) => setCaption(e.target.value)} />
      <label className="choice"><input type="checkbox" checked={stayed} onChange={(e) => setStayed(e.target.checked)} /><span>{t('media.cabin.stayed')}</span></label>
      <PicturePicker purpose="cabin" reference={category} kind={kind} caption={caption} ready={stayed} blockedWhy={t('media.cabin.needStay')} onSaved={() => { setCaption(''); reload() }} />
    </Card>
  )
}
