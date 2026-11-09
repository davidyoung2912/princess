import { useState } from 'react'
import { applyOmissions, storyCount, storyText, type StoryDay } from '../../domain/memoryStory'
import { t, th } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * Photo-to-memory curation (QOL-18): the guest's favourites and own diary notes laid out by day. They can leave out any photo or note and only then copy it.
 * It is built here from choices the guest already made, so nothing is uploaded and no one is recognised in a photo.
 */
export function MemoryStory({ story }: { story: readonly StoryDay[] }) {
  const [omitPhotos, setOmitPhotos] = useState<ReadonlySet<string>>(new Set())
  const [omitNotes, setOmitNotes] = useState<ReadonlySet<number>>(new Set())
  const [status, setStatus] = useState<string | null>(null)
  const shown = applyOmissions(story, omitPhotos, omitNotes)
  const count = storyCount(shown)
  const copy = async () => {
    try { await navigator.clipboard.writeText(storyText(shown)); setStatus(t('pho.story.copied')) } catch { setStatus(t('pho.story.failed')) }
  }
  return (
    <Card labelledBy="story-h">
      <h2 id="story-h" className="card__title">{th('pho.story.title')}</h2>
      <p>{t('pho.story.intro')}</p>
      {story.length === 0 ? <p className="muted">{t('pho.story.none')}</p> : (
        <>
          <p className="muted">{t('pho.story.count', count)}</p>
          {shown.map((d) => (
            <section key={d.day} aria-labelledby={`story-d${d.day}`}>
              <h3 id={`story-d${d.day}`}>{d.heading}</h3>
              {d.note && (
                <p>{d.note} <Button variant="tertiary" onClick={() => setOmitNotes(new Set(omitNotes).add(d.day))}>{t('pho.story.dropNote')}<span className="visually-hidden">: {d.heading}</span></Button></p>
              )}
              <ul className="plain-bullets">
                {d.photos.map((p) => (
                  <li key={p.id}>{p.title} <Button variant="tertiary" onClick={() => setOmitPhotos(new Set(omitPhotos).add(p.id))}>{t('pho.story.dropPhoto')}<span className="visually-hidden"> {p.title}</span></Button></li>
                ))}
              </ul>
            </section>
          ))}
          <div className="actions">
            <Button disabled={shown.length === 0} onClick={() => void copy()}>{t('pho.story.copy')}</Button>
            {(omitPhotos.size > 0 || omitNotes.size > 0) && <Button variant="tertiary" onClick={() => { setOmitPhotos(new Set()); setOmitNotes(new Set()) }}>{t('pho.story.reset')}</Button>}
          </div>
          <p role="status">{status}</p>
        </>
      )}
      <p className="muted">{t('pho.story.note')}</p>
    </Card>
  )
}
