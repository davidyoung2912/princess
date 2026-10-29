import { Link } from 'react-router'
import { asEmbarkView } from '../../api/guards'
import { COMPANION } from '../../domain/boarding'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { LoadError } from '../discover/parts'
import { ActionError } from '../account/parts'

/** Embarkation-day companion (CHK-12): one card at a time — terminal, security, photo, gangway, muster, cabin — with the next step always one tap away. */
export function CompanionScreen() {
  const me = usePersona()
  const embark = useSavedCopy('embark', me?.booker ?? 'none', () => api.boarding.embark(), asEmbarkView, [me?.id])
  const mark = useAction(async (step: (typeof COMPANION)[number], done: boolean) => { await api.boarding.setCompanion(step, done); embark.retry() })
  const view = embark.data
  const current = view?.current ?? null
  return (
    <div className="page">
      <h1>{t('route.companion')}</h1>
      <p>{t('companion.intro')}</p>
      {!view ? (embark.status === 'error' ? <LoadError retry={embark.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>) : (
        <>
          {embark.fromCopy && <Banner kind="offline" title={t('pass.offline')}><p>{t('companion.offline')}</p></Banner>}
          {current === null ? (
            <Banner kind="success" title={t('companion.allDone')} action={<LinkButton to="/" variant="secondary">{t('tab.home')}</LinkButton>}><p>{t('companion.allDoneBody')}</p></Banner>
          ) : (
            <Card labelledBy="now-h">
              <p className="eyebrow">{t('companion.now', { n: COMPANION.indexOf(current) + 1, total: COMPANION.length })}</p>
              <h2 id="now-h">{t(`companion.${current}` as StringKey)}</h2>
              <p>{t(`companion.${current}.body` as StringKey)}</p>
              {current === 'photo' && <p><Link to="/home/boarding-pass">{t('route.boardingPass')}</Link></p>}
              {current === 'terminal' && <p><Link to="/home/embarkation">{t('route.embarkation')}</Link></p>}
              <Button block disabled={mark.busy || !view.canEdit || embark.fromCopy} onClick={() => void mark.run(current, true)}>{t('companion.done')}</Button>
              <ActionError error={mark.error} />
            </Card>
          )}
          <section aria-labelledby="all-h">
            <h2 id="all-h">{t('companion.all')}</h2>
            <ol className="plain-list">
              {view.companion.map((c) => (
                <li key={c.id}>
                  <span>{t(`companion.${c.id}` as StringKey)}</span>
                  <span>
                    {c.done ? <StatusBadge kind="booked" label={t('checkin.done')} /> : c.id === current ? <StatusBadge kind="ready" label={t('companion.next')} /> : <StatusBadge kind="waitlist" label={t('checkin.todo')} />}
                    {c.done && view.canEdit && !embark.fromCopy && <> <Button variant="tertiary" disabled={mark.busy} onClick={() => void mark.run(c.id, false)}>{t('companion.undo')}<span className="visually-hidden"> {t(`companion.${c.id}` as StringKey)}</span></Button></>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      <p className="book-nav"><Link to="/home/embarkation">{t('route.embarkation')}</Link></p>
    </div>
  )
}
