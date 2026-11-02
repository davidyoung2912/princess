import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { asFolioView } from '../../api/guards'
import { ask, EXAMPLES, type Answer, type Facts } from '../../domain/assistant'
import { explainCharge } from '../../domain/moneyShield'
import { acceptChange, addProposal, requestChange, type Change } from '../../domain/planChange'
import { shipZoneAt } from '../../domain/sailings'
import { timeIn } from '../../domain/timezones'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useNow, useSailing, usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { usePilot } from '../../hooks/usePilot'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { BackLink } from '../onboard/common'
import { REFUSED } from '../plan/refused'
import { useShipTime } from '../onboard/shipTime'

interface Turn { id: number; question: string; answer: Answer }

const CHANGE_WORDS = /\b(move|change|shift|push|skip|drop|cancel|remove|add)\b/i

/** Ask your cruise (XA-01, XA-02): answers from the guest's own plan, checklist and bill, with sources. A change it can make is shown as a preview and only happens when the guest confirms; it can be undone for two hours. */
export function AskScreen() {
  const now = useNow()
  const sailing = useSailing()
  const time = useShipTime()
  const me = usePersona()
  const day = useCurrentDay()
  const dp = useDayPlan(day)
  const { update } = usePilot()
  const folio = useSavedCopy('folio', me?.booker ?? 'none', () => api.onboard.folio(), asFolioView, [me?.id])
  const checklist = useMine(() => api.plan.checklist.get())
  const [text, setText] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [proposal, setProposal] = useState<Change | null>(null)
  const [notice, setNotice] = useState<StringKey | null>(null)

  const facts = (): Facts => ({
    nowHhmm: timeIn(now, shipZoneAt(sailing, now)),
    plan: dp.rows,
    todo: checklist.data ? checklist.data.milestones.flatMap((m) => m.entries).filter((e) => e.state !== 'done' && !e.automatic).map((e) => ({ label: t(`plan.check.item.${e.id}` as never), path: e.to ?? '/plan/checklist' })) : null,
    charges: folio.data ? folio.data.lines.filter((l) => l.cents > 0).map((l) => { const x = explainCharge(l); return { label: l.description, cents: l.cents, reason: t(`explain.${x.id}` as StringKey, x.params) } }) : null,
    allAboard: dp.itineraryDay.allAboard ?? null,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q) return
    setNotice(null)
    setText('')
    if (CHANGE_WORDS.test(q)) {
      const r = requestChange(q, dp.rows, dp.alternatives, now, day)
      if (r.ok) { setProposal(r.change); return }
      setProposal(null)
      setTurns((all) => [{ id: all.length, question: q, answer: { text: t(r.reason === 'nothing' ? 'ask.cantFind' : 'ask.unclear'), sources: [], known: false } }, ...all])
      return
    }
    setProposal(null)
    setTurns((all) => [{ id: all.length, question: q, answer: ask(q, facts()) }, ...all])
  }

  const confirm = () => {
    if (!proposal) return
    const next = addProposal(dp.changes, proposal)
    const r = acceptChange(dp.base, next, proposal.id, now)
    if (r.ok) {
      update((s) => ({ ...s, changes: [...s.changes.filter((c) => c.day !== day), ...r.changes] }))
      setNotice('ask.done')
    } else setNotice(REFUSED[r.reason])
    setProposal(null)
  }

  return (
    <div className="page">
      <h1>{t('route.ask')}</h1>
      <p>{t('ask.intro')}</p>
      <p className="muted">{t('ask.promise')}</p>
      <form onSubmit={submit}>
        <Field label={t('ask.label')} hint={t('ask.hint')} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
        <Button type="submit">{t('ask.send')}</Button>
      </form>
      <ul className="plain-list" aria-label={t('ask.examples')}>
        {EXAMPLES.map((q) => <li key={q}><Button variant="tertiary" onClick={() => setTurns((all) => [{ id: all.length, question: q, answer: ask(q, facts()) }, ...all])}>{q}</Button></li>)}
      </ul>

      {proposal && (
        <Card labelledBy="ask-prop">
          <h2 id="ask-prop" className="card__title">{t('ask.preview')}</h2>
          <p><strong>{proposal.title}</strong></p>
          <p>{proposal.why}</p>
          <p className="muted">{t('ask.undoFor', { time: time(proposal.undoUntil) })}</p>
          <div className="button-row">
            <Button onClick={confirm}>{t('ask.confirm')}</Button>
            <Button variant="secondary" onClick={() => setProposal(null)}>{t('ask.cancel')}</Button>
          </div>
        </Card>
      )}
      {notice && <Banner kind="info" title={t(notice)}>{notice === 'ask.done' && <p><Link to="/plan/autopilot">{t('ask.seeLog')}</Link></p>}</Banner>}

      <section aria-label={t('ask.answers')} aria-live="polite">
        {turns.map((turn) => (
          <Card key={turn.id}>
            <p><strong>{turn.question}</strong></p>
            <p style={{ whiteSpace: 'pre-line' }}>{turn.answer.text}</p>
            {turn.answer.sources.length > 0 && <p className="muted">{t('ask.from')} {turn.answer.sources.map((s, i) => <span key={s.path}>{i > 0 ? ', ' : ''}<Link to={s.path}>{s.label}</Link></span>)}</p>}
          </Card>
        ))}
      </section>
      <BackLink to="/" label={t('route.home')} />
    </div>
  )
}
