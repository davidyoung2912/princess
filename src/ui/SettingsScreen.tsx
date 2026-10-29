import { Link } from 'react-router'
import { t } from '../i18n'
import { DisplaySettings } from './DisplaySettings'

export function SettingsScreen() {
  return (
    <div className="page">
      <h1>{t('route.settings')}</h1>
      <DisplaySettings />
      <p><Link to="/kit">{t('settings.kitLink')}</Link></p>
    </div>
  )
}
