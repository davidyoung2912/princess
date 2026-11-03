import { Link } from 'react-router'
import { t } from '../i18n'
import { Card } from './Card'
import { DataSettings } from './DataSettings'
import { DiagnosticsSettings } from './DiagnosticsSettings'
import { DisplaySettings } from './DisplaySettings'

export function SettingsScreen() {
  return (
    <div className="page">
      <h1>{t('route.settings')}</h1>
      <DisplaySettings />
      <DataSettings />
      <DiagnosticsSettings />
      <Card labelledBy="activity-h">
        <h2 id="activity-h">{t('settings.activity.title')}</h2>
        <p>{t('settings.activity.intro')}</p>
        <p><Link to="/me/activity">{t('settings.activity.link')}</Link></p>
      </Card>
      <p className="simple-hide"><Link to="/me/demo">{t('demo.link')}</Link></p>
      <p className="simple-hide"><Link to="/kit">{t('settings.kitLink')}</Link></p>
    </div>
  )
}
