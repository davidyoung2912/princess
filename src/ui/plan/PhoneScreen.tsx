import { Link } from 'react-router'
import { PHONE_STEPS, roamingMoment } from '../../domain/phoneSetup'
import { stageAt } from '../../domain/sailings'
import { useNow, useSailing } from '../../hooks/useDemo'
import { usePhoneSetup } from '../../hooks/usePhoneSetup'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'

/** Phone setup (XT-01, S3-07): the few steps that stop a phone roaming at sea, with a reminder that fits where the trip is. Guidance only; the app cannot see the phone's settings. */
export function PhoneScreen() {
  const { done, toggle } = usePhoneSetup()
  const moment = roamingMoment(stageAt(useSailing(), useNow()))
  return (
    <div className="page">
      <h1>{th('route.phone')}</h1>
      <p>{t('phone.intro')}</p>
      {moment !== 'none' && <Banner kind="warning" title={t(`phone.moment.${moment}` as StringKey)}><p>{t(`phone.moment.${moment}.body` as StringKey)}</p></Banner>}
      <Card labelledBy="phone-steps-h">
        <h2 id="phone-steps-h" className="card__title">{th('phone.steps')}</h2>
        <p role="status" className="muted">{t('phone.progress', { done: done.length, total: PHONE_STEPS.length })}</p>
        <ul className="plain-list">
          {PHONE_STEPS.map((s) => (
            <li key={s.id}>
              <label className="choice choice--top">
                <input type="checkbox" checked={done.includes(s.id)} onChange={() => toggle(s.id)} />
                <span>{t(`phone.step.${s.id}` as StringKey)}<small>{t(`phone.step.${s.id}.why` as StringKey)}</small></span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
      <p>{t('phone.wifiNote')} <Link to="/ship/wifi">{t('route.wifi')}</Link></p>
      <p className="muted">{t('phone.limits')}</p>
      <BackLink to="/plan" label={t('route.plan')} />
    </div>
  )
}
