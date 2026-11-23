import { useState } from 'react'
import { Link } from 'react-router'
import { noticesToShow } from '../domain/serviceNotice'
import { api } from '../runtime'
import { useMine } from '../hooks/useMine'
import { useOnline } from '../hooks/useOnline'
import { useVisibleInterval } from '../hooks/useVisibleInterval'
import { t, type StringKey } from '../i18n'
import { Banner } from './Banner'
import { Button } from './Button'

const REFRESH_MS = 5 * 60_000

/**
 * A known problem, on any screen (research 14.11): when the service has declared one that is not resolved, say so at the top with what it affects, so a guest does not
 * try the same failing action again and again. A feed that cannot be read shows nothing. A guest can put a notice away for this visit.
 */
export function ServiceNotice() {
  const online = useOnline()
  const incidents = useMine(() => api.help.incidents())
  const [away, setAway] = useState<ReadonlySet<string>>(new Set())
  useVisibleInterval(incidents.retry, REFRESH_MS, online)
  const show = online ? noticesToShow(incidents.data, away) : []
  if (show.length === 0) return null
  return (
    <div className="service-notice no-print">
      {show.map((i) => (
        <Banner key={i.id} kind="warning" title={t('svcnote.title', { area: t(`stat.s.${i.area}` as StringKey) })} action={<Button variant="tertiary" onClick={() => setAway(new Set([...away, i.id]))}>{t('svcnote.dismiss')}<span className="visually-hidden"> {t(`stat.s.${i.area}` as StringKey)}</span></Button>}>
          <p>{i.message}</p>
          <p>{t('svcnote.body')} <Link to="/me/status">{t('svcnote.see')}</Link></p>
        </Banner>
      ))}
    </div>
  )
}
