import { useId, useState } from 'react'
import { Link } from 'react-router'
import { normalizeControlResult, normalizeProposal, type ControlProposal, type ControlResult } from '../../ai/stanleyStanding'
import { t, th } from '../../i18n'
import { stanleyControl } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'

/**
 * Control in plain words (phase P9a). The guest types a sentence; it is read as one of six fixed controls and shown back. Nothing changes until they confirm, and the sentence is not kept.
 */
export function StanleyControlCard() {
  const [text, setText] = useState('')
  const [proposal, setProposal] = useState<ControlProposal | null>(null)
  const [done, setDone] = useState<ControlResult | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const id = useId()

  const ask = () => {
    setBusy(true); setFailed(false); setDone(null)
    stanleyControl.propose(text).then(
      (raw) => { const p = normalizeProposal(raw); setProposal(p); setFailed(p === null); setBusy(false) },
      () => { setFailed(true); setBusy(false) },
    )
  }
  const confirm = () => {
    if (!proposal) return
    setBusy(true); setFailed(false)
    stanleyControl.confirm(proposal.id).then(
      (raw) => { const r = normalizeControlResult(raw); setDone(r); setFailed(r === null); setProposal(null); setText(''); setBusy(false) },
      () => { setFailed(true); setBusy(false) },
    )
  }

  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('stanleyControl.title')}</h2>
      <p>{t('stanleyControl.intro')}</p>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) ask() }}>
        <Field label={t('stanleyControl.label')} hint={t('stanleyControl.hint')} value={text} maxLength={120} onChange={(e) => { setText(e.target.value); setProposal(null); setDone(null) }} />
        <div className="button-row"><Button type="submit" variant="secondary" disabled={busy || !text.trim()}>{t('stanleyControl.read')}</Button></div>
      </form>
      <div aria-live="polite">
        {failed && <p role="alert" className="field__error">{t('stanleyControl.error')}</p>}
        {proposal && (
          <div className="stack">
            <p><strong>{proposal.label}</strong></p>
            <p>{proposal.detail}</p>
            {!proposal.understood && <ul>{proposal.examples.map((x) => <li key={x}>{x}</li>)}</ul>}
            {proposal.understood && proposal.needsConfirm && (
              <div className="button-row">
                <Button disabled={busy} onClick={confirm}>{t('stanleyControl.confirm')}</Button>
                <Button variant="secondary" disabled={busy} onClick={() => setProposal(null)}>{t('stanleyControl.cancel')}</Button>
              </div>
            )}
            {proposal.understood && !proposal.needsConfirm && proposal.route && <Link className="button button--secondary" to={proposal.route}>{t('stanleyControl.open')}</Link>}
          </div>
        )}
        {done && (
          <div className="stack" role="status">
            <p>{done.message}</p>
            {done.route && <Link className="button button--secondary" to={done.route}>{t('stanleyControl.open')}</Link>}
          </div>
        )}
      </div>
    </Card>
  )
}
