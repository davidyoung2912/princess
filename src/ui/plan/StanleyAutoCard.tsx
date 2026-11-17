import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeAutoLists, normalizeAutoRun, type AutoLists, type AutoRun } from '../../ai/stanleyAuto'
import { t, th } from '../../i18n'
import { stanleyAuto } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Deadline reminders (phase P10a, AUT-02). Runs only when the guest taps the button, and the server sets something only if the guest has switched this on. Every word comes from the server.
 */
export function StanleyAutoCard() {
  const [result, setResult] = useState<AutoRun | null>(null)
  const [lists, setLists] = useState<AutoLists | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const live = useRef(true)

  const run = () => {
    live.current = true
    setBusy(true)
    stanleyAuto.deadlines().then(
      (raw) => { if (live.current) { const next = normalizeAutoRun(raw); setResult(next); setFailed(next === null); setBusy(false) } },
      () => { if (live.current) { setFailed(true); setBusy(false) } },
    )
  }

  const checkLists = () => {
    live.current = true
    setBusy(true)
    stanleyAuto.lists().then(
      (raw) => { if (live.current) { const next = normalizeAutoLists(raw); setLists(next); setFailed(next === null); setBusy(false) } },
      () => { if (live.current) { setFailed(true); setBusy(false) } },
    )
  }

  return (
    <Card labelledBy="auto-h">
      <h2 id="auto-h" className="card__title">{th('stanleyAuto.title')}</h2>
      <p>{t('stanleyAuto.intro')}</p>
      <div className="button-row"><Button onClick={run} disabled={busy}>{t('stanleyAuto.run')}</Button> <Button onClick={checkLists} disabled={busy}>{t('stanleyAuto.lists')}</Button></div>
      <div aria-live="polite">
        {busy && <p role="status">{t('stanleyAuto.working')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyAuto.error')}</p>}
        {result && !result.on && <p>{t('stanleyAuto.off')}</p>}
        {result?.on && result.made.length === 0 && result.waiting.length === 0 && <p role="status">{t('stanleyAuto.none')}</p>}
      </div>
      {lists && !lists.on && <p>{t('stanleyAuto.off')}</p>}
      {lists?.on && lists.firstLook && <p role="status">{t('stanleyAuto.listsFirst')}</p>}
      {lists?.on && !lists.firstLook && lists.changes.length === 0 && <p role="status">{t('stanleyAuto.listsSame')}</p>}
      {lists?.on && lists.changes.map((c) => (
        <section key={c.list} aria-label={c.list === 'checklist' ? t('stanleyAuto.checklistName') : t('stanleyAuto.packingName')}>
          {c.added.length > 0 && <><h3>{th(c.list === 'checklist' ? 'stanleyAuto.checklistDone' : 'stanleyAuto.listsAdded')}</h3><ul>{c.added.map((a) => <li key={a}>{a}</li>)}</ul></>}
          {c.removed.length > 0 && <><h3>{th(c.list === 'checklist' ? 'stanleyAuto.checklistUndone' : 'stanleyAuto.listsRemoved')}</h3><ul>{c.removed.map((a) => <li key={a}>{a}</li>)}</ul></>}
        </section>
      ))}
      {result?.on && result.made.length > 0 && (
        <section aria-labelledby="auto-made">
          <h3 id="auto-made">{th('stanleyAuto.made')}</h3>
          <ul>{result.made.map((m) => <li key={m.key}>{m.text} {when(m.dueAt)} ({m.receipt})</li>)}</ul>
          <p><Link to="/me/stanley-activity">{t('stanleyAuto.undo')}</Link></p>
        </section>
      )}
      {result?.on && result.waiting.length > 0 && (
        <section aria-labelledby="auto-wait">
          <h3 id="auto-wait">{th('stanleyAuto.waiting')}</h3>
          <ul>{result.waiting.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}
      {(lists ?? result) && (lists ?? result)!.notChecked.length > 0 && (
        <section aria-labelledby="auto-not">
          <h3 id="auto-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{(lists ?? result)!.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
    </Card>
  )
}
