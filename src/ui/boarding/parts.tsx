import type { BoardingView, GuestPass } from '../../api/types'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { QrCode } from '../checkin/QrCode'

/** One guest's pass: name, group, stateroom, muster station and the code. A pass that is not ready shows what is missing instead of a code. */
export function PassFace({ pass, p, big }: { pass: BoardingView; p: GuestPass; big?: boolean }) {
  return (
    <div className={['pass__face', big ? 'pass__face--big' : ''].filter(Boolean).join(' ')}>
      <h2 className="pass__name">{p.name}</h2>
      <p className="pass__printed">{p.printed}</p>
      {p.ready ? <QrCode text={p.code} label={t('pass.qrLabel', { name: p.name })} className="pass__qr" /> : <p className="pass__missing">{t('pass.noCode')}</p>}
      <dl className="pass__facts">
        <div><dt>{t('pass.group')}</dt><dd>{p.group}</dd></div>
        <div><dt>{t('pass.lane')}</dt><dd>{t(pass.lane === 'green' ? 'pass.lane.green' : 'pass.lane.blue')}</dd></div>
        <div><dt>{t('pass.stateroom')}</dt><dd>{p.cabin}</dd></div>
        <div><dt>{t('pass.muster')}</dt><dd>{p.muster}</dd></div>
        <div><dt>{t('pass.terminalLabel')}</dt><dd>{pass.terminal.name}</dd></div>
        <div><dt>{t('pass.booking')}</dt><dd>{pass.number}</dd></div>
      </dl>
    </div>
  )
}

/** "What if my phone dies or has no signal?" (CHK-14): the plan, in plain steps. */
export function FailsafeCard({ number }: { number: string }) {
  const steps = ['saved', 'print', 'number', 'desk', 'key'] as const
  return (
    <Card labelledBy="failsafe-h">
      <h2 id="failsafe-h" className="card__title">{t('pass.failsafe')}</h2>
      <ul className="plain-bullets">{steps.map((k) => <li key={k}>{t(`pass.failsafe.${k}` as StringKey, { number })}</li>)}</ul>
      <p className="no-print"><a href={`tel:${number}`}>{t('pass.failsafe.call', { number })}</a></p>
    </Card>
  )
}
