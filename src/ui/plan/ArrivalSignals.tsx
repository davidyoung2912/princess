import { liveSignals, sendSignal, SIGNAL_KINDS, signalsOpen, type SignalKind } from '../../domain/arrivalSignal'
import { stageAt } from '../../domain/sailings'
import { useNow, useSailing } from '../../hooks/useDemo'
import { usePilot } from '../../hooks/usePilot'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { useShipTime } from '../onboard/shipTime'

/** One-tap, one-time arrival signals for the party (GTS-10): departed, arrived, at the meeting point. Never a live location; closed once boarding begins. */
export function ArrivalSignals() {
  const { state, update } = usePilot()
  const now = useNow()
  const sailing = useSailing()
  const when = useShipTime()
  const open = signalsOpen(stageAt(sailing, now))
  const sent = liveSignals(state.signals, open)
  return (
    <Card labelledBy="sig-h">
      <h2 id="sig-h" className="card__title">{th('signal.title')}</h2>
      <p>{t('signal.intro')}</p>
      {!open && <p role="status">{t('signal.closed')}</p>}
      <ul className="plain-list">
        {SIGNAL_KINDS.map((k: SignalKind) => {
          const at = sent.find((s) => s.kind === k)?.at
          return (
            <li key={k}>
              {at !== undefined ? <span role="status">{t(`signal.sent.${k}` as StringKey, { time: when(at) })}</span> : (
                <Button variant="secondary" disabled={!open} onClick={() => update((s) => ({ ...s, signals: sendSignal(s.signals, k, now, open) }))}>{t(`signal.send.${k}` as StringKey)}</Button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="muted">{t('signal.noTrack')}</p>
    </Card>
  )
}
