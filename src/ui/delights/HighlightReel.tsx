import { useState } from 'react'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { slideSeconds, reelText, type ReelSlide } from '../../domain/highlightReel'
import { t, th } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

async function shareText(text: string, title: string): Promise<'shared' | 'copied' | 'failed' | null> {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return 'shared' }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (e) {
    return (e as Error).name === 'AbortError' ? null : 'failed'
  }
}

/**
 * The Highlight Reel (N-R1): the trip as a short slideshow. It starts stopped; Play moves on by itself (about 45 seconds in all) and Pause, Back and Next
 * always work, so nothing moves faster than the guest can follow. Under reduced motion the slides change with no fade. Nothing is saved or posted;
 * Share sends only the slides that carry none of the guest's own words.
 */
export function HighlightReel({ slides }: { slides: readonly ReelSlide[] }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const last = slides.length - 1
  const seconds = slideSeconds(slides.length)

  // One tick a second while playing (and only while the page is showing); a slide moves on after its seconds, and the reel stops on the last one.
  const [waited, setWaited] = useState(0)
  useVisibleInterval(() => {
    if (waited + 1 < seconds) { setWaited(waited + 1); return }
    setWaited(0)
    if (index + 1 >= last) setPlaying(false)
    setIndex(Math.min(last, index + 1))
  }, 1000, playing)
  const go = (i: number) => { setWaited(0); setIndex(Math.max(0, Math.min(last, i))) }

  if (slides.length === 0) return null
  const slide = slides[Math.min(index, last)]
  const play = () => { if (index >= last) go(0); setPlaying(true) }
  const share = async () => {
    const r = await shareText(reelText(slides), t('reel.title'))
    setStatus(r === null ? null : t(`recap.shared.${r}` as 'recap.shared.shared'))
  }

  return (
    <Card labelledBy="reel-title">
      <h2 id="reel-title" className="card__title">{th('reel.title')}</h2>
      <p>{t('reel.intro', { seconds: slides.length * seconds })}</p>
      <div className="reel" role="group" aria-roledescription="carousel" aria-label={t('reel.title')}>
        <div className="reel__slide" key={slide.id} aria-live={playing ? 'off' : 'polite'}>
          <p className="reel__kicker">{slide.kicker}</p>
          <p className="reel__big">{slide.title}</p>
          <p>{slide.line}</p>
        </div>
        <progress className="meter" max={last} value={index} aria-label={t('reel.position', { n: index + 1, total: slides.length })} />
        <p className="muted">{t('reel.position', { n: index + 1, total: slides.length })}</p>
      </div>
      <div className="actions no-print">
        {playing ? <Button onClick={() => setPlaying(false)}>{t('reel.pause')}</Button> : <Button onClick={play}>{index >= last ? t('reel.again') : index > 0 ? t('reel.resume') : t('reel.play')}</Button>}
        <Button variant="secondary" onClick={() => { setPlaying(false); go(index - 1) }} disabled={index === 0}>{t('reel.back')}</Button>
        <Button variant="secondary" onClick={() => { setPlaying(false); go(index + 1) }} disabled={index >= last}>{t('reel.next')}</Button>
        <Button variant="tertiary" onClick={() => void share()}>{t('reel.share')}</Button>
      </div>
      {status && <p role="status">{status}</p>}
      <p className="muted">{t('reel.note')}</p>
    </Card>
  )
}
