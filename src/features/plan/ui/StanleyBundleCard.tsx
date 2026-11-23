import { useState } from 'react'
import { Link } from 'react-router'
import { clock12, DRAFT_KINDS, normalizeBundle, normalizeDraft, PACES, SCOPES, type Bundle, type DraftKind, type DraftNote, type Pace, type Scope } from '../../stanley/logic/stanleyBundle'
import { t, th, type StringKey } from '../../../shared/i18n'
import { stanleyBundle } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { CopyText } from '../../../shared/ui/CopyText'

/**
 * Bundles and drafts (phase P4): an evening or a day as ordered steps at a chosen pace, and a note the guest can copy and send themselves. Read-only: each step opens the screen where it is done, and
 * nothing is booked, held or sent from here. The server works out every step and word.
 */
export function StanleyBundleCard() {
  const [scope, setScope] = useState<Scope>('evening')
  const [pace, setPace] = useState<Pace>('balanced')
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [draft, setDraft] = useState<DraftNote | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const show = async () => {
    setBusy(true); setFailed(false); setDraft(null)
    try {
      const next = normalizeBundle(await stanleyBundle.get(scope, pace))
      setBundle(next); setFailed(next === null)
    } catch { setFailed(true) }
    setBusy(false)
  }

  const write = async (kind: DraftKind) => {
    setBusy(true); setFailed(false)
    try { setDraft(normalizeDraft(await stanleyBundle.draft(kind, scope, pace))) } catch { setFailed(true) }
    setBusy(false)
  }

  return (
    <Card labelledBy="bundle-h">
      <h2 id="bundle-h" className="card__title">{th('stanleyBundle.title')}</h2>
      <p>{t('stanleyBundle.intro')}</p>
      <fieldset className="choice-group">
        <legend>{t('stanleyBundle.scope')}</legend>
        {SCOPES.map((s) => <label key={s} className="choice"><input type="radio" name="bundle-scope" checked={scope === s} onChange={() => setScope(s)} /><span>{t(`stanleyBundle.scope.${s}` as StringKey)}</span></label>)}
      </fieldset>
      <fieldset className="choice-group">
        <legend>{t('stanleyBundle.pace')}</legend>
        {PACES.map((p) => <label key={p} className="choice"><input type="radio" name="bundle-pace" checked={pace === p} onChange={() => setPace(p)} /><span>{t(`stanleyBundle.pace.${p}` as StringKey)}</span></label>)}
      </fieldset>
      <div className="button-row"><Button onClick={() => void show()} disabled={busy}>{t('stanleyBundle.show')}</Button></div>
      <div aria-live="polite">
        {busy && <p role="status">{t('stanleyBundle.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyBundle.error')}</p>}
        {bundle && !bundle.hasPlan && <p>{t('stanleyBundle.none')}</p>}
      </div>
      {bundle?.hasPlan && (
        <>
          <ol className="stack">
            {bundle.steps.map((s) => (
              <li key={s.id}>
                <strong>{clock12(s.start)} {s.title}</strong> <span className="badge">{t(`stanleyBundle.${s.status}` as StringKey)}</span>
                {s.why && <p>{s.why}</p>}
                <Link className="button button--secondary" to={s.route}>{t('stanleyBundle.open')}</Link>
              </li>
            ))}
          </ol>
          {bundle.backBy && <p>{t('stanleyBundle.backBy', { time: clock12(bundle.backBy) })}</p>}
          {bundle.clashes.length > 0 && (
            <section aria-labelledby="bundle-clash">
              <h3 id="bundle-clash">{th('stanleyBundle.clashes')}</h3>
              <ul>{bundle.clashes.map((c) => <li key={c}>{c}</li>)}</ul>
            </section>
          )}
          <section aria-labelledby="bundle-not">
            <h3 id="bundle-not">{th('stanleyCheckup.notChecked')}</h3>
            <ul>{bundle.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
          </section>
          <div className="button-row">
            {DRAFT_KINDS.map((k) => <Button key={k} variant="secondary" onClick={() => void write(k)} disabled={busy}>{t(k === 'party-plan' ? 'stanleyBundle.draftParty' : 'stanleyBundle.draftLate')}</Button>)}
          </div>
        </>
      )}
      {draft && (
        <section aria-labelledby="bundle-draft">
          <h3 id="bundle-draft">{th('stanleyBundle.draftTitle')}</h3>
          <p>{t('stanleyBundle.draftHelp')}</p>
          <div style={{ whiteSpace: 'pre-line' }}><CopyText text={draft.text} label={t('stanleyBundle.copy')} /></div>
        </section>
      )}
    </Card>
  )
}
