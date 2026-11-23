import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeAutoDrafts, normalizeAutoLists, normalizeAutoPlan, normalizeAutoRun, type AutoDrafts, type AutoLists, type AutoPlan, type AutoRun } from '../../stanley/logic/stanleyAuto'
import { t, th } from '../../../shared/i18n'
import { stanleyAuto } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Rung 4 safe and plan classes (phases P10a and P10b): deadline reminders (AUT-02), lists kept current (AUT-05), my plan topped up (AUT-03) and drafts saved (AUT-06). Each runs only when the guest taps its button, and the server
 * does something only if the guest has switched that class on. Every word comes from the server.
 */
export function StanleyAutoCard() {
  const [result, setResult] = useState<AutoRun | null>(null)
  const [lists, setLists] = useState<AutoLists | null>(null)
  const [plan, setPlan] = useState<AutoPlan | null>(null)
  const [drafts, setDrafts] = useState<AutoDrafts | null>(null)
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

  const topUp = () => {
    live.current = true
    setBusy(true)
    stanleyAuto.plan().then(
      (raw) => { if (live.current) { const next = normalizeAutoPlan(raw); setPlan(next); setFailed(next === null); setBusy(false) } },
      () => { if (live.current) { setFailed(true); setBusy(false) } },
    )
  }

  const removePick = (day: number, id: string) => {
    live.current = true
    setBusy(true)
    stanleyAuto.removePick(day, id).then(
      (raw) => { if (live.current) { const next = normalizeAutoPlan(raw); if (next) setPlan((old) => (old ? { ...old, picks: next.picks } : next)); setFailed(next === null); setBusy(false) } },
      () => { if (live.current) { setFailed(true); setBusy(false) } },
    )
  }

  const saveNotes = () => {
    live.current = true
    setBusy(true)
    stanleyAuto.drafts().then(
      (raw) => { if (live.current) { const next = normalizeAutoDrafts(raw); setDrafts(next); setFailed(next === null); setBusy(false) } },
      () => { if (live.current) { setFailed(true); setBusy(false) } },
    )
  }

  const notChecked = (plan ?? drafts ?? lists ?? result)?.notChecked ?? []

  return (
    <Card labelledBy="auto-h">
      <h2 id="auto-h" className="card__title">{th('stanleyAuto.title')}</h2>
      <p>{t('stanleyAuto.intro')}</p>
      <div className="button-row"><Button onClick={run} disabled={busy}>{t('stanleyAuto.run')}</Button> <Button variant="secondary" onClick={checkLists} disabled={busy}>{t('stanleyAuto.lists')}</Button> <Button variant="secondary" onClick={topUp} disabled={busy}>{t('stanleyAuto.plan')}</Button> <Button variant="secondary" onClick={saveNotes} disabled={busy}>{t('stanleyAuto.drafts')}</Button></div>
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
        <section key={c.list} aria-label={c.list === 'checklist' ? t('stanleyAuto.checklistName') : c.list === 'shortlist' ? t('stanleyAuto.shortlistName') : c.list === 'comparison' ? t('stanleyAuto.comparisonName') : t('stanleyAuto.packingName')}>
          {c.added.length > 0 && <><h3>{th(c.list === 'checklist' ? 'stanleyAuto.checklistDone' : c.list === 'shortlist' ? 'stanleyAuto.shortlistAdded' : c.list === 'comparison' ? 'stanleyAuto.comparisonMoved' : 'stanleyAuto.listsAdded')}</h3><ul>{c.added.map((a) => <li key={a}>{a}</li>)}</ul></>}
          {c.removed.length > 0 && <><h3>{th(c.list === 'checklist' ? 'stanleyAuto.checklistUndone' : c.list === 'shortlist' ? 'stanleyAuto.shortlistGone' : 'stanleyAuto.listsRemoved')}</h3><ul>{c.removed.map((a) => <li key={a}>{a}</li>)}</ul></>}
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
      {plan && !plan.on && <p>{t('stanleyAuto.planOff')}</p>}
      {plan?.on && plan.picks.length === 0 && plan.added.length === 0 && <p role="status">{t('stanleyAuto.planNone')}</p>}
      {plan?.on && plan.added.length > 0 && (
        <section aria-labelledby="auto-added">
          <h3 id="auto-added">{th('stanleyAuto.planAdded')}</h3>
          <ul>{plan.added.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      )}
      {plan?.on && plan.removed.length > 0 && (
        <section aria-labelledby="auto-removed">
          <h3 id="auto-removed">{th('stanleyAuto.planRemoved')}</h3>
          <ul>{plan.removed.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      )}
      {plan?.on && plan.picks.length > 0 && (
        <section aria-labelledby="auto-picks">
          <h3 id="auto-picks">{th('stanleyAuto.planPicks')}</h3>
          <ul>
            {plan.picks.map((p) => (
              <li key={`${p.day}:${p.id}`}>
                {t('stanleyAuto.planDay', { day: p.day })}, {p.start}: {p.title}{' '}
                <Button onClick={() => removePick(p.day, p.id)} disabled={busy} aria-label={t('stanleyAuto.planRemove', { title: p.title, day: p.day })}>{t('stanleyAuto.planRemoveLabel')}</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {drafts && !drafts.on && <p>{t('stanleyAuto.draftsOff')}</p>}
      {drafts?.on && drafts.saved.length === 0 && <p role="status">{t('stanleyAuto.draftsSame')}</p>}
      {drafts?.on && drafts.saved.length > 0 && (
        <section aria-labelledby="auto-saved">
          <h3 id="auto-saved">{th('stanleyAuto.draftsSaved')}</h3>
          <ul>{drafts.saved.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      )}
      {drafts?.on && drafts.drafts.length > 0 && (
        <section aria-labelledby="auto-drafts">
          <h3 id="auto-drafts">{th('stanleyAuto.draftsKept')}</h3>
          {drafts.drafts.map((d) => (
            <div key={d.kind}>
              <h4>{t(`stanleyAuto.draft.${d.kind}`)}</h4>
              <p style={{ whiteSpace: 'pre-line' }}>{d.text}</p>
            </div>
          ))}
        </section>
      )}
      {notChecked.length > 0 && (
        <section aria-labelledby="auto-not">
          <h3 id="auto-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
    </Card>
  )
}
