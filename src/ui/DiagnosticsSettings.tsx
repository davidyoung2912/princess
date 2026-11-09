import { useState } from 'react'
import { clearLog, logToText, readLog } from '../diagnostics/log'
import { clearAsked, clearTiers, freeShare, modelShare, readAsked, readTiers, repeated, tierMix } from '../diagnostics/stanleyTiers'
import { LIBRARY, questionOf } from '../ai/stanleyLibrary'
import { SHIP_FACTS } from '../domain/finishMore'
import { t, th, type StringKey } from '../i18n'
import { Button } from './Button'
import { Card } from './Card'

const store = (): Storage | null => {
  try { return window.localStorage } catch { return null }
}

/** The question behind a counted written answer: an authored library question or a ship fact. */
function askedQuestion(id: string): string {
  const [kind, key] = id.split(':')
  return (kind === 'ship' ? SHIP_FACTS.find((f) => f.id === key)?.q : (() => { const e = LIBRARY.find((x) => x.id === key); return e ? questionOf(e) : undefined })()) ?? id
}

/** The on-device problem log: read it, copy it for Guest Services, or clear it. Nothing in it is sent anywhere. */
export function DiagnosticsSettings() {
  const [entries, setEntries] = useState(() => readLog(store()))
  const [note, setNote] = useState('')
  const [tiers, setTiers] = useState(() => readTiers(store()))
  const share = freeShare(tiers)
  const paid = modelShare(tiers)
  const [asked, setAsked] = useState(() => readAsked(store()))
  const again = repeated(asked)

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
      {tierMix(tiers).some((m) => m.count > 0) ? (
        <>
          <ul>{tierMix(tiers).map((m) => <li key={m.tier}>{t(`diag.stanley.${m.tier}` as StringKey)}: {m.count} ({m.percent}%)</li>)}</ul>
          {share !== null && <p>{t('diag.stanley.share', { percent: share })}</p>}
          {paid !== null && <p>{t('diag.stanley.modelShare', { percent: paid })}</p>}
          <h4>{t('diag.stanley.repeat.title')}</h4>
          {again.length === 0 ? <p>{t('diag.stanley.repeat.none')}</p> : <ul>{again.map((a) => <li key={a.id}>{t('diag.stanley.repeat.line', { question: askedQuestion(a.id), count: a.count })}</li>)}</ul>}
          <Button variant="secondary" onClick={() => { clearTiers(store()); clearAsked(store()); setTiers(readTiers(store())); setAsked(readAsked(store())) }}>{t('diag.stanley.clear')}</Button>
        </>
      ) : <p>{t('diag.stanley.none')}</p>}
      <p role="status">{note}</p>
    </Card>
  )
}
