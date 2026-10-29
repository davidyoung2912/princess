import { useState, type ChangeEvent, type FormEvent } from 'react'
import { readLog } from '../../diagnostics/log'
import { systemStatus } from '../../domain/services'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useDemo } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { useShipTime } from '../onboard/shipTime'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { TextArea } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { AboardError, Back } from './common'
import type { FeedbackKind } from '../../api/aboardTypes'

/** What is working and what is not (SUP-04), with the known issues and what to do meanwhile. */
export function StatusScreen() {
  const demo = useDemo()
  const rows = systemStatus(demo.scenarios, demo.network.offline)
  const issues = rows.filter((r) => r.issue)
  return (
    <div className="page">
      <h1>{t('route.status')}</h1>
      {issues.length === 0 ? <Banner kind="success" title={t('stat.allOk')}><p>{t('stat.allOkBody')}</p></Banner> : <Banner kind="warning" title={t('stat.some', { count: issues.length })}><p>{t('stat.someBody')}</p></Banner>}
      <ul className="card-grid">
        {rows.map((r) => (
          <li key={r.id}>
            <Card>
              <h2 className="card__title">{t(`stat.s.${r.id}` as StringKey)}</h2>
              <p><StatusBadge kind={r.health === 'ok' ? 'booked' : r.health === 'slow' ? 'waitlist' : 'changed'} label={t(`stat.h.${r.health}` as StringKey)} /></p>
              {r.issue && <p>{t(`stat.issue.${r.id}` as StringKey)}</p>}
            </Card>
          </li>
        ))}
      </ul>
      <p className="muted">{t('stat.concept')}</p>
      <Back to="/me/help" label={t('route.helpCentre')} />
    </div>
  )
}

const MAX_SHOT = 1_000_000
const storage = (): Storage | null => { try { return window.localStorage } catch { return null } }

/** Tell us about a problem or an idea (SUP-05), with the on-device problem log and a picture of the screen if you choose. Nothing is attached unless ticked. */
export function ReportProblemScreen() {
  const list = useMine(() => api.aboard.feedback.list())
  const shipTime = useShipTime()
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [text, setText] = useState('')
  const [withLog, setWithLog] = useState(false)
  const [shot, setShot] = useState<string | null>(null)
  const [shotError, setShotError] = useState(false)
  const log = readLog(storage()).map((e) => `${e.at.slice(0, 16)} ${e.kind} ${e.message}`)
  const send = useAction(async () => {
    await api.aboard.feedback.send({ kind, text, log: withLog ? log : [], screenshot: shot })
    setText('')
    setShot(null)
    setWithLog(false)
    list.retry()
  })
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setShotError(false)
    if (!file) { setShot(null); return }
    if (!file.type.startsWith('image/') || file.size > MAX_SHOT) { setShot(null); setShotError(true); return }
    const reader = new FileReader()
    reader.onload = () => setShot(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }
  return (
    <div className="page">
      <h1>{t('route.reportProblem')}</h1>
      <p>{t('bug.intro')}</p>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void send.run() }}>
        <fieldset className="plain-fieldset">
          <legend>{t('bug.kind')}</legend>
          {(['bug', 'idea', 'praise'] as const).map((k) => (
            <label key={k} className="choice"><input type="radio" name="fb-kind" checked={kind === k} onChange={() => setKind(k)} /><span>{t(`bug.k.${k}` as StringKey)}</span></label>
          ))}
        </fieldset>
        <TextArea label={t('bug.text')} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
        <label className="choice">
          <input type="checkbox" checked={withLog} disabled={log.length === 0} onChange={(e) => setWithLog(e.target.checked)} />
          <span>{log.length === 0 ? t('bug.noLog') : t('bug.attachLog', { count: log.length })}</span>
        </label>
        <div className="field">
          <label htmlFor="fb-shot">{t('bug.shot')}</label>
          <p className="field__hint">{t('bug.shotHint')}</p>
          <input id="fb-shot" type="file" accept="image/*" onChange={pick} />
          {shotError && <p role="alert" className="field__error">{t('bug.shotBad')}</p>}
          {shot && <p className="muted">{t('bug.shotOk')}</p>}
        </div>
        <AboardError error={send.error} />
        <Button type="submit" disabled={send.busy || text.trim().length < 5}>{t('bug.send')}</Button>
      </form>
      <h2>{t('bug.sent')}</h2>
      <Load state={list}>
        {(rows) => rows.length === 0 ? <p className="muted">{t('bug.none')}</p> : (
          <ul className="plain-bullets">
            {rows.map((r) => <li key={r.id}><strong>{r.reference}</strong> · {t(`bug.k.${r.kind}` as StringKey)} · {shipTime(r.at)}<br />{r.text}</li>)}
          </ul>
        )}
      </Load>
      <p className="muted">{t('bug.private')}</p>
      <Back to="/me/help" label={t('route.helpCentre')} />
    </div>
  )
}
