import type { OnboardToday } from '../api/types'
import type { JourneyStage } from '../routes/hubs'
import { useShipLook, type ShipLook } from '../hooks/useShipLook'
import { SEA_BARS } from '../domain/shipLook'
import { t, type StringKey } from '../i18n'
import { StageHero } from './StageHero'

/** Three wave bars; the filled ones say how rough the sea is. The words beside it carry the meaning. */
function SeaGauge({ sea }: { sea: NonNullable<ShipLook['sea']> }) {
  const n = SEA_BARS[sea]
  return (
    <span className="sea-gauge">
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" focusable="false">
        {[0, 1, 2].map((i) => <path key={i} d={`M1 ${13 - i * 5} q 3 -3 5 0 t 5 0 t 5 0 t 5 0`} fill="none" strokeWidth="2" strokeLinecap="round" className={i < n ? 'sea-gauge__on' : 'sea-gauge__off'} />)}
      </svg>
      {t('look.sea', { state: t(`look.sea.${sea}` as StringKey) })}
    </span>
  )
}

/** The greeting for the part of the day: sunrise and sunset with the time to them, a quiet night line, nothing by day. */
function greeting(look: ShipLook): string | null {
  const m = look.minutes ?? 0
  if (look.phase === 'sunrise') return m > 0 && look.sunrise ? t('look.greet.sunrise.soon', { time: look.sunrise }) : t('look.greet.sunrise.now')
  if (look.phase === 'sunset') {
    if (m <= 0) return t('look.greet.sunset.now')
    return look.sunsetSide && look.sunsetSide !== 'neither' ? t('look.greet.sunset.soon', { count: m, side: look.sunsetSide }) : t('look.greet.sunset.soonEither', { count: m })
  }
  return look.phase === 'night' ? t('look.greet.night') : null
}

/** The stage picture with the ship's own sky over it (L4, F1 and F2): a tint for sunrise, sunset and night, one light weather effect, a wave gauge and a greeting line.
 * The tint and effect are decoration only, never behind text, and CSS drops them in calm mode, Quiet fun level, reduced motion (effects only), data-light and high contrast. */
export function AtmosphereHero({ stage, today }: { stage: JourneyStage; today: OnboardToday | null | undefined }) {
  const look = useShipLook(today)
  const line = greeting(look)
  return (
    <>
      <div className="atmo" data-phase={look.phase} data-fx={look.effect}>
        <StageHero stage={stage} />
        <span className="atmo__tint fun-only" aria-hidden="true" />
        <span className="atmo__fx fun-only" aria-hidden="true" />
      </div>
      {(line || look.sea) && (
        <p className="atmo-line">
          {look.sea && <SeaGauge sea={look.sea} />}
          {line && <span className="atmo-line__text">{line}</span>}
        </p>
      )}
    </>
  )
}
