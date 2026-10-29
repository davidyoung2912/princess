import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { formatDate } from '../../domain/cruise'
import { SAILINGS } from '../../domain/sailings'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { ErrorSummary, Field } from '../Field'
import { ActionError, Load } from './parts'
import { TripCard } from './tripParts'

/** My Trips (MNG-01): every booking in one place, past trips, and a way to link one made elsewhere (ACT-02). */
export function TripsScreen() {
  const trips = useMine(() => api.trips.list())
  const navigate = useNavigate()
  const [number, setNumber] = useState('')
  const [lastName, setLastName] = useState('')
  const [departure, setDeparture] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const link = useAction((n: string, l: string, d: string) => api.trips.link(n, l, d))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const found: string[] = []
    if (!number.trim()) found.push(t('trips.link.needNumber'))
    if (!lastName.trim()) found.push(t('trips.link.needName'))
    if (!departure) found.push(t('trips.link.needDate'))
    setProblems(found)
    if (found.length > 0) return
    const trip = await link.run(number, lastName, departure)
    if (trip) navigate(`/me/trips/${trip.number}`)
  }
  const code = link.error?.code

  return (
    <div className="page">
      <h1>{t('route.trips')}</h1>
      <Load state={trips}>
        {(data) => (
          <>
            <section aria-labelledby="up-h">
              <h2 id="up-h">{t('trips.upcoming')}</h2>
              {data.upcoming.length === 0 ? <Card info><p>{t('trips.noneUpcoming')}</p></Card> : <ul className="card-grid">{data.upcoming.map((x) => <TripCard key={x.number} trip={x} />)}</ul>}
            </section>
            <section aria-labelledby="past-h">
              <h2 id="past-h">{t('trips.past')}</h2>
              {data.past.length === 0 ? <p className="muted">{t('trips.nonePast')}</p> : (
                <ul className="plain-list">
                  {data.past.map((p) => <li key={p.id}><span>{p.title} <span className="muted">· {p.ship} · {formatDate(p.departure)} · {t('trips.nights', { count: p.nights })}{p.cancelled ? ` · ${t('trips.cancelled')}` : ''}</span></span></li>)}
                </ul>
              )}
            </section>
          </>
        )}
      </Load>

      <section aria-labelledby="link-h">
        <h2 id="link-h">{t('trips.link.title')}</h2>
        <p>{t('trips.link.intro')}</p>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <ErrorSummary title={t('trips.link.fix')} errors={problems} />
          {code === 'notFound' && <Banner kind="warning" title={t('trips.link.noMatch')}><p>{t('trips.link.noMatchBody')}</p></Banner>}
          {code === 'conflict' && <Banner kind="info" title={t('trips.link.already')} />}
          {code === 'invalid' && <Banner kind="warning" title={t('trips.link.format')} />}
          {code && !['notFound', 'conflict', 'invalid'].includes(code) && <ActionError error={link.error} />}
          <Field label={t('trips.link.number')} hint={t('trips.link.numberHint')} value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          <Field label={t('trips.link.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          <div className="field">
            <label htmlFor="link-date">{t('trips.link.date')}</label>
            <select id="link-date" value={departure} onChange={(e) => setDeparture(e.target.value)}>
              <option value="">{t('trips.link.chooseDate')}</option>
              {SAILINGS.map((s) => <option key={s.id} value={s.departure}>{formatDate(s.departure)}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={link.busy}>{link.busy ? t('account.saving') : t('trips.link.submit')}</Button>
        </form>
        <p className="muted">{t('trips.link.demoHint')}</p>
      </section>
    </div>
  )
}
