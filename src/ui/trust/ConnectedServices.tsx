import { api } from '../../runtime'
import { t } from '../../i18n'
import { useMine } from '../../hooks/useMine'
import { Card } from '../Card'
import { ThirdPartyChip } from './ThirdPartyChip'

/** Where the information in the app comes from: the outside services that are on, what each is used for, what is sent to it, and what never is. */
export function ConnectedServices() {
  const state = useMine(() => api.help.connectedServices())
  const data = state.data
  if (!data) return null
  return (
    <Card info>
      <h2>{t('trust.title')}</h2>
      {data.services.length === 0 ? <p>{t('trust.none')}</p> : (
        <ul className="plain-bullets">
          {data.services.map((s) => (
            <li key={s.id}>
              <ThirdPartyChip credit={s.name} /> {s.purpose}. {t('trust.sent')} {s.sent.join('; ')}.
            </li>
          ))}
        </ul>
      )}
      <p>{t('trust.label')}</p>
      <h3>{t('trust.neverTitle')}</h3>
      <ul className="plain-bullets">{data.neverSent.map((n) => <li key={n}>{n}</li>)}</ul>
    </Card>
  )
}
