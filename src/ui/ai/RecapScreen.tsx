import { useState } from 'react'
import { buildRecap, recapText } from '../../domain/recap'
import { formatDate } from '../../domain/cruise'
import { partyOf } from '../../domain/personas'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { usePersona, useSailing } from '../../hooks/useDemo'
import { useSailed } from '../../hooks/useStage'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { RouteMap } from '../discover/parts'
import { BackLink } from '../onboard/common'

/** Trip memories (POS-03): the cruise gathered into one page, with a map, the numbers, the tours and the favourite table, and a short text to share. */
export function RecapScreen() {
  const sailing = useSailing()
  const me = usePersona()
  const sailed = useSailed()
  const data = useMine(async () => {
    const [tours, dining, photos] = await Promise.all([api.plan.excursions.list(), api.plan.dining.view(), api.photos.list()])
    return { tours: tours.booked.filter((b) => b.status === 'booked').map((b) => b.excursionId), dinners: dining.reservations.map((r) => r.venueId), photos: photos.photos.length }
  })
  const [shared, setShared] = useState<'shared' | 'copied' | 'failed' | null>(null)
  return (
    <div className="page">
      <h1>{t('route.recap')}</h1>
      <p>{t('recap.intro')}</p>
      {!sailed && <Banner kind="info" title={t('recap.early.title')}><p>{t('recap.early.body')}</p></Banner>}
      <Load state={data}>
        {(d) => {
          const recap = buildRecap({ sailing, party: me ? partyOf(me.id).map((p) => p.firstName) : [], ...d })
          const share = async () => {
            const text = recapText(recap)
            try {
              if (navigator.share) { await navigator.share({ title: recap.title, text }); setShared('shared') } else { await navigator.clipboard.writeText(text); setShared('copied') }
            } catch (e) {
              setShared((e as Error).name === 'AbortError' ? null : 'failed')
            }
          }
          return (
            <>
              <Card hero labelledBy="recap-h">
                <h2 id="recap-h" className="card__title">{recap.title}</h2>
                <p className="muted">{t('recap.nights', { count: recap.nights })} · {recap.dates}</p>
                <RouteMap />
              </Card>
              <Card labelledBy="recap-nums-h">
                <h2 id="recap-nums-h" className="card__title">{t('recap.numbers')}</h2>
                <dl className="recap-stats">
                  <div><dt>{t('recap.ports')}</dt><dd>{recap.ports.length}</dd></div>
                  <div><dt>{t('recap.seaDays')}</dt><dd>{recap.seaDays}</dd></div>
                  <div><dt>{t('recap.miles')}</dt><dd>{recap.nauticalMiles.toLocaleString('en-US')}</dd></div>
                  <div><dt>{t('recap.photos')}</dt><dd>{recap.photos}</dd></div>
                  <div><dt>{t('recap.dinners')}</dt><dd>{recap.dinnerCount}</dd></div>
                </dl>
              </Card>
              <Card labelledBy="recap-tours-h">
                <h2 id="recap-tours-h" className="card__title">{t('recap.ashore')}</h2>
                {recap.tourNames.length === 0 ? <p>{t('recap.noTours')}</p> : <ul className="plain-bullets">{recap.tourNames.map((n) => <li key={n}>{n}</li>)}</ul>}
                <p>{recap.favouriteMeal ? t('recap.favourite', { name: recap.favouriteMeal.name, count: recap.favouriteMeal.times }) : t('recap.noMeal')}</p>
                <p className="muted">{t('recap.ports.list', { ports: recap.ports.join(', ') })}</p>
              </Card>
              <Card labelledBy="recap-share-h">
                <h2 id="recap-share-h" className="card__title">{t('recap.share')}</h2>
                <pre className="recap-text">{recapText(recap)}</pre>
                <Button onClick={() => void share()}>{t('recap.shareButton')}</Button>
                {shared && <p role="status">{t(`recap.shared.${shared}`)}</p>}
                <p className="muted">{t('recap.privacy', { date: formatDate(sailing.departure) })}</p>
              </Card>
            </>
          )
        }}
      </Load>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}
