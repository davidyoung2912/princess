import { useEffect, useRef, useState } from 'react'
import { normalizeGuardianCopies, type GuardianCopies } from '../../ai/stanleyGroup'
import { t, th } from '../../i18n'
import { stanleyGroup } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * Guardian copies (phase P11, reminders R8): the guardian taps once and each child's all-aboard time becomes a reminder on their own list, labelled with the child's first name. The child is sent nothing. Every word of what was set comes from the server.
 */
export function StanleyGuardianCard() {
  const [result, setResult] = useState<GuardianCopies | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const live = useRef(true)
  useEffect(() => () => { live.current = false }, [])

  const run = () => {
    live.current = true
    setBusy(true)
    stanleyGroup.guardian().then(
      (raw) => { if (live.current) { const r = normalizeGuardianCopies(raw); setResult(r); setFailed(r === null); setBusy(false) } },
      () => { if (live.current) { setFailed(true); setBusy(false) } },
    )
  }

  return (
    <Card labelledBy="guardian-h">
      <h2 id="guardian-h" className="card__title">{th('stanleyGuardian.title')}</h2>
      <p>{t('stanleyGuardian.intro')}</p>
      <Button disabled={busy} onClick={run}>{t('stanleyGuardian.run')}</Button>
      {failed && <p role="alert" className="field__error">{t('stanleyGuardian.error')}</p>}
      {result && !result.hasChildren && <p role="status">{t('stanleyGuardian.none')}</p>}
      {result && result.hasChildren && (
        <div role="status">
          <p>{result.made.length === 0 ? t('stanleyGuardian.nothingNew', { names: result.children.join(', ') }) : t('stanleyGuardian.made', { count: result.made.length })}</p>
          {result.made.length > 0 && <ul>{result.made.map((m) => <li key={m.key}>{m.text}</li>)}</ul>}
          {result.waiting.length > 0 && <ul className="muted">{result.waiting.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}
      {(result?.notChecked ?? []).length > 0 && <ul className="muted">{result?.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>}
    </Card>
  )
}
