import { useState, type ImgHTMLAttributes } from 'react'
import { useSettings } from '../hooks/useSettings'
import { t } from '../i18n'
import { Button } from './Button'

/**
 * A content photo (not an icon or mascot). In data-light mode nothing is fetched until the guest taps the button (OFF-06, NET-04, PERF-05);
 * otherwise it loads lazily as usual. `name` is what the button names, so a screen reader can tell the buttons apart.
 */
export function DeferredImage({ name, src, alt, ...img }: { name: string; src: string; alt: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  const [settings] = useSettings()
  const [asked, setAsked] = useState(false)
  if (settings.dataLight && !asked) return <Button variant="secondary" onClick={() => setAsked(true)}>{t('img.show', { name })}</Button>
  return <img loading="lazy" decoding="async" {...img} src={src} alt={alt} />
}
