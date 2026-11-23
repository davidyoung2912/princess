import { useChatWaiting } from '../hooks/useChatSummary'
import { t } from '../../../shared/i18n'
import { Banner } from '../../../shared/ui/Banner'
import { LinkButton } from '../../../shared/ui/Button'

/** A quiet row on Home while chat requests wait for an answer. It stays until they are answered, so a notice that went away is never the only trace. */
export function ChatNeedsYou() {
  const count = useChatWaiting()
  if (count === 0) return null
  return (
    <Banner kind="info" title={t('needs.title', { count })} action={<LinkButton to="/chat/people?invitations=1" variant="secondary">{t('needs.open')}</LinkButton>} />
  )
}
