import { Link } from 'react-router'
import { requestStanley } from '../../stanley/logic/stanleyOpen'
import { useStanleyCapabilities } from '../../../shared/hooks/useStanleyCapabilities'
import { headingCase, t, th } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

/** What Stanley can do (docs/stanley-actions-and-proactive-plan.md, P0): the server's catalogue, grouped, each with an example and a Try-it that opens Stanley with the words ready. The app holds no list of its own. */
export function StanleyCanScreen() {
  const { catalogue, status, retry } = useStanleyCapabilities()
  if (!catalogue) {
    return (
      <div className="page">
        <p role="status">{status === 'error' ? t('stanleyCan.error') : t('stanleyCan.loading')}</p>
        {status === 'error' ? <div className="button-row"><Button variant="secondary" onClick={retry}>{t('stanleyCan.retry')}</Button></div> : null}
      </div>
    )
  }
  return (
    <div className="page">
      <p>{t('stanleyCan.intro')}</p>
      {catalogue.groups.map((g) => {
        const items = catalogue.items.filter((i) => i.group === g.id)
        return items.length === 0 ? null : (
          <Card key={g.id} labelledBy={`stanley-can-${g.id}`}>
            <h2 id={`stanley-can-${g.id}`}>{headingCase(g.title)}</h2>
            <p className="muted">{g.intro}</p>
            <ul className="stanley-can__list">
              {items.map((i) => (
                <li key={i.id}>
                  <h3>{i.title}</h3>
                  <p>{i.summary}</p>
                  {i.state === 'needsBooking' ? <p className="muted">{t('stanleyCan.needsBooking')}</p> : null}
                  <div className="button-row"><Button variant="secondary" onClick={() => requestStanley(i.example)} aria-label={t('stanleyIntro.tryFor', { example: i.example })}>{t('stanleyIntro.try')}</Button></div>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}
      <p><Link to="/me/stanley-activity">{t('stanleyActivity.link')}</Link></p>
      <Card info labelledBy="stanley-can-never-h" tour="stanley-never">
        <h2 id="stanley-can-never-h">{th('stanleyIntro.never.title')}</h2>
        <p>{t('stanleyIntro.never.body')}</p>
      </Card>
    </div>
  )
}
