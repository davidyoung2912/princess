import { useState } from 'react'
import { clearLog, logToText, readLog } from '../diagnostics/log'
import { t } from '../i18n'
import { Button } from './Button'
import { Card } from './Card'

const store = (): Storage | null => {
  try { return window.localStorage } catch { return null }
}

/** The on-device problem log: read it, copy it for Guest Services, or clear it. Nothing in it is sent anywhere. */
export function DiagnosticsSettings() {
  const [entries, setEntries] = useState(() => readLog(store()))
  const [note, setNote] = useState('')

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
      <h2 id="diag-h">{t('diag.title')}</h2>
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
      <p role="status">{note}</p>
    </Card>
  )
}
