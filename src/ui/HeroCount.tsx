import { heroCount } from '../domain/homeLook'
import { t, type StringKey } from '../i18n'

/** The days to sailing as a big number, with a light caption that changes each week (a hint of Stanley's voice). Hidden in calm mode, like the countdown it replaces. */
export function HeroCount({ days }: { days: number }) {
  const h = heroCount(days)
  if (h.kind === 'today') return <p className="hero-count calm-hide"><strong className="hero-count__line">{t('herocount.today')}</strong></p>
  if (h.kind === 'sailed') return <p className="hero-count calm-hide"><strong className="hero-count__line">{t('trip.sailed')}</strong></p>
  return (
    <p className="hero-count calm-hide">
      <strong className="hero-count__num">{h.value}</strong>{' '}
      <span className="hero-count__unit">{t('herocount.unit', { count: h.value })}</span>
      <span className="hero-count__caption fun-only">{t(`herocount.caption.${h.caption}` as StringKey)}</span>
    </p>
  )
}
