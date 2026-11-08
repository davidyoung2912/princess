import type { JourneyStage } from '../routes/hubs'
import { artUrl } from '../art/urls'

/** The wide picture at the top of a stage's Home. Decorative (empty alt); hidden in high contrast and softened in calm mode and the dark themes by CSS. */
export function StageHero({ stage }: { stage: JourneyStage }) {
  const wide = artUrl({ kind: 'hero', id: stage, size: 'wide' })
  if (!wide) return null
  const narrow = artUrl({ kind: 'hero', id: stage, size: 'narrow' })
  return (
    <div className="stage-hero" data-stage={stage}>
      <img src={wide} srcSet={narrow ? `${narrow} 600w, ${wide} 1200w` : undefined} sizes="(min-width: 48rem) 48rem, 100vw" alt="" width={1200} height={400} decoding="async" fetchPriority="low" />
    </div>
  )
}
