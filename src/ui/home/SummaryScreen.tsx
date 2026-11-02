import { useState } from 'react'
import { Link } from 'react-router'
import { asFolioView } from '../../api/guards'
import { explainCharge } from '../../domain/moneyShield'
import { LEGAL, type LegalId } from '../../domain/policy'
import { SUMMARY_LEVELS, summariseBill, summariseNotice, summarisePlan, summaryText, type Summary, type SummaryLevel } from '../../domain/plainSummary'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'

type Subject = 'day' | 'bill' | LegalId

/** Plain-English summaries (XA-05): the day, the bill or a notice, at a level the guest picks, always beside the original. Made by rules from the original, only when asked; nothing is reworded, sent or saved. */
export function SummaryScreen() {
  const me = usePersona()
  const day = useCurrentDay()
  const dp = useDayPlan(day)
  const folio = useSavedCopy('folio', me?.booker ?? 'none', () => api.onboard.folio(), asFolioView, [me?.id])
  const [subject, setSubject] = useState<Subject>('day')
  const [level, setLevel] = useState<SummaryLevel>('plain')
  const [reading, setReading] = useState(false)
  const [note, setNote] = useState('')
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  const title = subject === 'day' ? t('sum.subject.day') : subject === 'bill' ? t('sum.subject.bill') : LEGAL.find((l) => l.id === subject)!.title
  let s: Summary | null = null
  if (subject === 'day') s = dp.ready ? summarisePlan(dp.rows, level) : null
  else if (subject === 'bill') s = folio.data ? summariseBill(folio.data.lines.filter((l) => l.cents > 0).map((l) => { const x = explainCharge(l); return { label: l.description, cents: l.cents, reason: t(`explain.${x.id}` as StringKey, x.params) } }), level) : null
  else { const doc = LEGAL.find((l) => l.id === subject)!; s = summariseNotice(doc.title, '/me/trips', doc.body, level) }

  const numbered = level === 'steps'
  const choose = (next: Subject) => { setSubject(next); setNote('') }
  const read = () => {
    if (!s) return
    const synth = window.speechSynthesis
    if (reading) { synth.cancel(); setReading(false); return }
    const u = new SpeechSynthesisUtterance(summaryText(s, title, numbered))
    u.onend = () => setReading(false)
    setReading(true)
    synth.speak(u)
  }
  const copy = async () => {
    if (!s) return
    try { await navigator.clipboard.writeText(summaryText(s, title, numbered)); setNote(t('sum.copied')) } catch { setNote(t('sum.copyFailed')) }
  }

  return (
    <div className="page">
      <BackLink to="/home/ask" label={t('route.ask')} />
      <h1>{t('route.summary')}</h1>
      <p>{t('sum.intro')}</p>
      <div className="button-row" role="group" aria-label={t('sum.what')}>
        {(['day', 'bill', ...LEGAL.map((l) => l.id)] as Subject[]).map((k) => (
          <Button key={k} variant={subject === k ? 'primary' : 'secondary'} aria-pressed={subject === k} onClick={() => choose(k)}>{k === 'day' ? t('sum.subject.day') : k === 'bill' ? t('sum.subject.bill') : LEGAL.find((l) => l.id === k)!.title}</Button>
        ))}
      </div>
      <div className="button-row" role="group" aria-label={t('sum.level')}>
        {SUMMARY_LEVELS.map((l) => <Button key={l} variant={level === l ? 'primary' : 'secondary'} aria-pressed={level === l} onClick={() => { setLevel(l); setNote('') }}>{t(`sum.level.${l}` as StringKey)}</Button>)}
      </div>
      <p className="muted">{t(`sum.levelHint.${level}` as StringKey)}</p>
      {s === null ? <p role="status" className="muted">{t(folio.status === 'error' ? 'sum.cannotSee' : 'account.loading')}</p> : (
        <div className="summary-pair">
          <Card labelledBy="sum-h">
            <h2 id="sum-h" className="card__title">{t('sum.summary')}</h2>
            <p className="muted">{t('sum.made')}</p>
            {numbered ? <ol>{s.lines.map((l) => <li key={l}>{l}</li>)}</ol> : <ul>{s.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
            <div className="button-row">
              {canSpeak ? <Button variant="secondary" onClick={read}>{reading ? t('brief.stop') : t('brief.readAloud')}</Button> : <p className="muted">{t('brief.noVoice')}</p>}
              <Button variant="tertiary" onClick={() => void copy()}>{t('sum.copy')}</Button>
            </div>
            <p role="status">{note}</p>
          </Card>
          <Card labelledBy="sum-o">
            <h2 id="sum-o" className="card__title">{t('sum.original')}</h2>
            <ul>{s.original.map((l) => <li key={l}>{l}</li>)}</ul>
            <p><Link to={s.source.path}>{t('sum.openOriginal', { name: s.source.label })}</Link></p>
          </Card>
        </div>
      )}
      <p className="muted">{t('sum.note')}</p>
    </div>
  )
}
