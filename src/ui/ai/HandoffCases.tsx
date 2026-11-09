import { useEffect, useState } from 'react'
import { normalizeCases, type StanleyCase } from '../../ai/stanleyHandoff'
import { useNow } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { stanleyHandoffs } from '../../runtime'
import { CaseStatusLine } from './HandoffCard'

/** The guest's cases with Guest Services, newest first, each with its owner, status and next update; an overdue case shows the number to call. Nothing shows when there are none or the list cannot be read. */
export function HandoffCases() {
  const now = useNow()
  const [cases, setCases] = useState<StanleyCase[]>([])
  useEffect(() => {
    let live = true
    void stanleyHandoffs.list().then((r) => { if (live) setCases(normalizeCases(r).slice(0, 5)) }, () => {})
    return () => { live = false }
  }, [])
  if (cases.length === 0) return null
  return (
    <section aria-labelledby="ai-cases-h" className="stanley__note">
      <h3 id="ai-cases-h">{t('handoff.cases')}</h3>
      <ul>
        {cases.map((c) => (
          <li key={c.id}>
            <p><strong>{t('handoff.refLine', { reference: c.reference, topic: t(`handoff.topic.${c.topic}` as StringKey) })}</strong></p>
            <CaseStatusLine c={c} now={now} />
          </li>
        ))}
      </ul>
    </section>
  )
}
