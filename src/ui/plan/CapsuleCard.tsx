import { useState } from 'react'
import { Link } from 'react-router'
import { useCapsule } from '../../hooks/useCapsule'
import { batteryNow, watchBattery } from '../../data/battery'
import { nightBeforeTest, type ReadinessReport } from '../../domain/nightBefore'
import { CAPSULE_KINDS, formatBytes, formatWhen, storageState } from '../../domain/offlineCapsule'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'

/** What this phone has saved for use with no signal: size, age, when each copy stops being used, and whether the browser will keep it (MOB-03, MOB-04, QOL-04). */
export function CapsuleCard() {
  const { capsule, storage, checkedAt, check, protect } = useCapsule()
  const [answer, setAnswer] = useState<'granted' | 'declined' | null>(null)
  const state = storageState(storage)
  const [report, setReport] = useState<{ at: number; r: ReadinessReport } | null>(null)
  const runTest = () => {
    watchBattery()
    check()
    const notifications = typeof Notification === 'undefined' ? null : Notification.permission
    setReport({ at: checkedAt, r: nightBeforeTest({ capsule, storage: state, notifications, battery: batteryNow() }) })
  }
  const essentials = CAPSULE_KINDS.filter((k) => k.essential)
  const saved = new Map(capsule.rows.map((r) => [r.kind, r]))
  return (
    <Card labelledBy="capsule-h">
      <h2 id="capsule-h" className="card__title">{th('capsule.title')}</h2>
      <p>{t('capsule.intro')}</p>
      <Banner kind={capsule.readiness === 'ready' ? 'success' : 'warning'} title={t(`capsule.${capsule.readiness}` as StringKey)}>
        {capsule.missing.length > 0 && (
          <ul className="plain-list">
            {capsule.missing.map((m) => (
              <li key={m.kind}>{t(`capsule.kind.${m.kind}` as StringKey)}: <Link to={m.path}>{t('capsule.open')}</Link></li>
            ))}
          </ul>
        )}
      </Banner>
      <ul className="plain-list">
        {[...essentials, ...CAPSULE_KINDS.filter((k) => !k.essential)].filter((k) => saved.has(k.kind)).map((k) => {
          const r = saved.get(k.kind)!
          return (
            <li key={k.kind}>
              <strong>{t(`capsule.kind.${k.kind}` as StringKey)}</strong>
              <small className="muted"> {t('capsule.saved', { time: formatWhen(r.savedAt) })} · {t('capsule.until', { time: formatWhen(r.expiresAt) })} · {formatBytes(r.bytes)}{r.copies > 1 ? ` · ${t('capsule.copies', { count: r.copies })}` : ''}</small>
              <br />
              <span className={`capsule__state capsule__state--${r.state}`}>{t(`capsule.state.${r.state}` as StringKey)}</span>
              {r.state !== 'fresh' && <> <Link to={r.path}>{t('capsule.open')}</Link></>}
            </li>
          )
        })}
      </ul>
      <p className="muted">{t('capsule.size', { size: formatBytes(capsule.totalBytes) })}</p>
      {capsule.unreadable > 0 && <p role="status">{t('capsule.unreadable', { count: capsule.unreadable })}</p>}
      <p role="status">{t(`capsule.storage.${state}` as StringKey)}</p>
      {state !== 'protected' && state !== 'unknown' && (
        <Button variant="secondary" onClick={() => { void protect().then((ok) => setAnswer(ok ? 'granted' : 'declined')) }}>{t('capsule.protect')}</Button>
      )}
      {answer && <p role="status">{t(`capsule.protect.${answer}` as StringKey)}</p>}
      <Button onClick={runTest}>{t('ready.run')}</Button>
      {report && (
        <div role="status">
          <p><strong>{t(`ready.result.${report.r.result}` as StringKey)}</strong> <small className="muted">{t('ready.ran', { time: formatWhen(report.at) })}</small></p>
          <ul className="plain-list">
            {report.r.checks.map((c) => <li key={c.id}>{t(`ready.${c.id}.${c.result}` as StringKey)}</li>)}
          </ul>
        </div>
      )}
      <Button variant="secondary" onClick={check}>{t('capsule.check')}</Button>
      <p role="status" className="muted">{t('capsule.checked', { time: formatWhen(checkedAt) })}</p>
      <p className="muted">{t('capsule.crew')}</p>
    </Card>
  )
}
