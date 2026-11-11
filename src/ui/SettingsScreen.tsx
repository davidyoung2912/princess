import { Link } from 'react-router'
import { t, th } from '../i18n'
import { AvatarPicker } from './AvatarPicker'
import { Card } from './Card'
import { DataSettings } from './DataSettings'
import { DiagnosticsSettings } from './DiagnosticsSettings'
import { DisplaySettings } from './DisplaySettings'
import { StanleySettings } from './StanleySettings'
import { TipsSettings } from './TipsSettings'

export function SettingsScreen() {
  return (
    <div className="page">
      <DisplaySettings />
      <Card labelledBy="avatar-h">
        <h2 id="avatar-h">{th('avatar.title')}</h2>
        <p>{t('avatar.intro')}</p>
        <AvatarPicker />
      </Card>
      <StanleySettings />
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
