import { useState } from 'react'
import { Link } from 'react-router'
import { t, th } from '../i18n'
import { AvatarPicker } from './AvatarPicker'
import { Card } from './Card'
import { ContactSettings, VerifyStep, type ContactKind } from './ContactSteps'
import { DataSettings } from './DataSettings'
import { DiagnosticsSettings } from './DiagnosticsSettings'
import { DisplaySettings } from './DisplaySettings'
import { StanleyAuthority } from './StanleyAuthority'
import { StanleySettings } from './StanleySettings'
import { TipsSettings } from './TipsSettings'

export function SettingsScreen() {
  const [verifying, setVerifying] = useState<ContactKind | null>(null)
  const [round, setRound] = useState(0)
  // Confirming is the same page as at the welcome step, in place of the settings until it is done or skipped.
  if (verifying) return <VerifyStep kind={verifying} onDone={() => { setVerifying(null); setRound((n) => n + 1) }} />
  return (
    <div className="page">
      <DisplaySettings />
      <Card labelledBy="avatar-h" tour="settings-avatar">
        <h2 id="avatar-h">{th('avatar.title')}</h2>
        <p>{t('avatar.intro')}</p>
        <AvatarPicker />
      </Card>
      <ContactSettings key={round} onVerify={setVerifying} />
      <StanleySettings />
      <StanleyAuthority source="settings" full />
      <TipsSettings />
      <DataSettings />
      <DiagnosticsSettings />
      <Card labelledBy="activity-h">
        <h2 id="activity-h">{th('settings.activity.title')}</h2>
        <p>{t('settings.activity.intro')}</p>
        <p><Link to="/me/activity">{t('settings.activity.link')}</Link></p>
      </Card>
      <p className="simple-hide"><Link to="/me/demo">{t('demo.link')}</Link></p>
      <p className="simple-hide"><Link to="/kit">{t('settings.kitLink')}</Link></p>
    </div>
  )
}
