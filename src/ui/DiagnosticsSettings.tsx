import { useState } from 'react'
import { clearLog, logToText, readLog } from '../diagnostics/log'
import { clearTiers, freeShare, readTiers, TIERS } from '../diagnostics/stanleyTiers'
import { t, th, type StringKey } from '../i18n'
import { Button } from './Button'
import { Card } from './Card'

const store = (): Storage | null => {
  try { return window.localStorage } catch { return null }
}

/** The on-device problem log: read it, copy it for Guest Services, or clear it. Nothing in it is sent anywhere. */
export function DiagnosticsSettings() {
  const [entries, setEntries] = useState(() => readLog(store()))
  const [note, setNote] = useState('')
  const [tiers, setTiers] = useState(() => readTiers(store()))
  const share = freeShare(tiers)

  async function copy() {
    try {
      await navigator.clipboard.writeText(logToText(entries))
      setNote(t('diag.copied'))
    } catch {
      setNote(t('diag.copyFailed'))
    }
  }

  return (
    <Card labelledBy="diag-h">
      <h2 id="diag-h">{th('diag.title')}</h2>
      <p>{t('diag.intro')}</p>
      {entries.length === 0 ? (
        <p>{t('diag.none')}</p>
      ) : (
        <>
          <details>
            <summary>{t('diag.count', { count: entries.length })}</summary>
            <ul>
              {entries.map((e, i) => <li key={i}><small>{e.at.slice(0, 16).replace('T', ' ')} · {e.kind} · {e.message}</small></li>)}
            </ul>
          </details>
          <div className="button-row">
            <Button variant="secondary" onClick={() => void copy()}>{t('diag.copy')}</Button>
            <Button variant="secondary" onClick={() => { clearLog(store()); setEntries([]); setNote(t('diag.cleared')) }}>{t('diag.clear')}</Button>
          </div>
        </>
      )}
      <h3>{t('diag.stanley.title')}</h3>
      <p>{t('diag.stanley.intro')}</p>
      {TIERS.some((k) => tiers[k] > 0) ? (
        <>
          <ul>{TIERS.map((k) => <li key={k}>{t(`diag.stanley.${k}` as StringKey)}: {tiers[k]}</li>)}</ul>
          {share !== null && <p>{t('diag.stanley.share', { percent: share })}</p>}
          <Button variant="secondary" onClick={() => { clearTiers(store()); setTiers(readTiers(store())) }}>{t('diag.stanley.clear')}</Button>
        </>
      ) : <p>{t('diag.stanley.none')}</p>}
      <p role="status">{note}</p>
    </Card>
  )
}
