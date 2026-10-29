import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { EMERGENCY_NUMBER } from '../../domain/contacts'
import { MAX_REPORT_TEXT, REPORT_KINDS, URGENT_REPORTS, type ReportKind } from '../../domain/services'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useShipTime } from '../onboard/shipTime'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'
import { Load } from '../account/parts'
import { AboardError, Back } from './common'

/** A way to tell the ship about a security or safety concern, or a person overboard (SAF-04). An overboard report says to call first. */
export function ReportScreen() {
  const list = useMine(() => api.aboard.reports.list())
  const shipTime = useShipTime()
  const [kind, setKind] = useState<ReportKind>('theft')
  const [where, setWhere] = useState('')
  const [note, setNote] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const urgent = URGENT_REPORTS.includes(kind)
  const send = useAction(async () => {
    await api.aboard.reports.create({ kind, where, note, anonymous })
    setWhere('')
    setNote('')
    list.retry()
  })
  const submit = (e: FormEvent) => { e.preventDefault(); void send.run() }
  return (
    <div className="page">
      <h1>{t('route.report')}</h1>
      <Banner kind="danger" title={t('rep.callFirst', { number: EMERGENCY_NUMBER })}>
        <p>{t('rep.callFirstBody')} <a href={`tel:${EMERGENCY_NUMBER}`}>{EMERGENCY_NUMBER}</a></p>
      </Banner>
      <form onSubmit={submit}>
        <fieldset className="plain-fieldset">
          <legend>{t('rep.kind')}</legend>
          {REPORT_KINDS.map((k) => (
            <label key={k} className="choice choice--top">
              <input type="radio" name="rep-kind" checked={kind === k} onChange={() => setKind(k)} />
              <span>{t(`rep.k.${k}` as StringKey)}</span>
            </label>
          ))}
        </fieldset>
        {urgent && <Banner kind="warning" title={t('rep.overboard')}><p>{t('rep.overboardBody')}</p></Banner>}
        <Field label={t('rep.where')} hint={t('rep.whereHint')} value={where} maxLength={120} onChange={(e) => setWhere(e.target.value)} />
        <TextArea label={t('rep.note')} value={note} maxLength={MAX_REPORT_TEXT} onChange={(e) => setNote(e.target.value)} />
        {!urgent && (
          <label className="choice">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <span>{t('rep.anonymous')}</span>
          </label>
        )}
        <AboardError error={send.error} />
        <Button type="submit" disabled={send.busy || !where.trim() || !note.trim()}>{urgent ? t('rep.sendUrgent') : t('rep.send')}</Button>
      </form>
      <h2>{t('rep.sent')}</h2>
      <Load state={list}>
        {(rows) => rows.length === 0 ? <p className="muted">{t('rep.none')}</p> : (
          <ul className="card-grid">
            {rows.map((r) => (
              <li key={r.id}>
                <Card>
                  <h3 className="card__title">{t(`rep.k.${r.kind}` as StringKey)}</h3>
                  <p className="muted">{t('rep.ref', { ref: r.reference })} · {shipTime(r.at)}{r.anonymous ? ` · ${t('rep.wasAnonymous')}` : ''}</p>
                  <p>{r.where}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Load>
      <p className="muted">{t('rep.privacy')} <Link to="/me/privacy">{t('route.privacy')}</Link></p>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}
