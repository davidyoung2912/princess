import { t } from '../i18n'
import { LinkButton } from './Button'

export function NotFound() {
  return (
    <div className="page">
      <h1>{t('shell.notFound.title')}</h1>
      <p>{t('shell.notFound.body')}</p>
      <LinkButton to="/">{t('shell.notFound.home')}</LinkButton>
    </div>
  )
}
