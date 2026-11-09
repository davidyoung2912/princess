import { clockPill } from '../domain/homeLook'
import { clockView, zoneChangeNear } from '../domain/clockView'
import type { Sailing } from '../domain/sailings'
import { t, type StringKey } from '../i18n'

/** "Same as ship time", "1 hour behind ship time" … for a clock compared with the ship's. */
function difference(hours: number): string {
  if (hours === 0) return t('clock.same')
  const count = Math.abs(hours)
  return t(hours < 0 ? 'clock.behind' : 'clock.ahead', { count })
}

/** Ship time, local port time and phone time side by side, each labelled in words (POR-11). */
export function ThreeClocks({ sailing, at, phoneZone }: { sailing: Sailing; at: number; phoneZone: string }) {
  const view = clockView(sailing, at, phoneZone)
  const change = zoneChangeNear(sailing, at)
  return (
    <>
    {change && change.hours !== 0 && <p role="status" className="clocks__notice"><strong>{t(change.upcoming ? 'clock.changeSoon' : 'clock.changed', { hours: Math.abs(change.hours), dir: t(change.hours > 0 ? 'clock.fwd' : 'clock.back') })}</strong></p>}
    <p className={`clock-pill clock-pill--${clockPill(view.phoneVsShip).tone}`} role="status">{view.phoneVsShip === 0 ? t('clock.pill.same') : t(view.phoneVsShip < 0 ? 'clock.pill.ahead' : 'clock.pill.behind', { count: Math.abs(view.phoneVsShip) })}</p>
    <dl className="clocks">
      {view.readings.map((r) => {
        const diff = r.kind === 'ship' ? null : difference(r.kind === 'port' ? view.portVsShip! : view.phoneVsShip)
        return (
          <div key={r.kind} className="clocks__item">
            <dt>{t(`clock.${r.kind}` as StringKey)}</dt>
            <dd>
              <strong className="clocks__time">{r.time}</strong> <span>{r.day}</span>
              {diff && <small className="clocks__diff">{diff}</small>}
            </dd>
          </div>
        )
      })}
    </dl>
    {view.phoneVsShip !== 0 && <p className="muted">{t('clock.phoneRule')}</p>}
    </>
  )
}
