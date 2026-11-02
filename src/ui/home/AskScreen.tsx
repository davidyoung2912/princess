import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ask } from '../../ai/concierge'
import type { Citation } from '../../ai/types'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { parseExcursionRequest, parseItemRequest, speechRecognitionOf, type ExcursionRequest, type ItemRequest } from '../../domain/finishMore'
import { requestItem } from '../../domain/services'
import { acceptChange, addProposal, requestChange, type Change } from '../../domain/planChange'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useNow, useSailing, usePersona } from '../../hooks/useDemo'
import { usePilot } from '../../hooks/usePilot'
import { programmeFollows } from '../../pilot/programme'
import { t, type StringKey } from '../../i18n'
import { api, sendConcierge } from '../../runtime'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { BackLink } from '../onboard/common'
import { REFUSED } from '../plan/refused'
import { useShipTime } from '../onboard/shipTime'

/** What the server's concierge said to one question, with the screens it used. */
interface Answer { text: string; sources: Citation[] }
interface Turn { id: number; question: string; answer: Answer }

/** Suggested questions; the concierge answers them from the guest's own plan, checklist and bill. */
const EXAMPLES: readonly string[] = ['What time is dinner?', 'What is next?', 'What do I still need to do?', 'When must I be back on the ship?', 'Summarise my day']

const CHANGE_WORDS = /\b(move|change|shift|push|skip|drop|cancel|remove|add)\b/i

/** Ask your cruise (XA-01, XA-02): answers from the guest's own plan, checklist and bill, with sources. A change it can make is shown as a preview and only happens when the guest confirms; it can be undone for two hours. */
export function AskScreen() {
  const now = useNow()
  const sailing = useSailing()
  const time = useShipTime()
  const [busy, setBusy] = useState(false)
  const me = usePersona()
  const day = useCurrentDay()
  const dp = useDayPlan(day)
  const { state: pilot, update } = usePilot()
  const [text, setText] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [proposal, setProposal] = useState<Change | null>(null)
  const [notice, setNotice] = useState<StringKey | null>(null)
  const [itemReq, setItemReq] = useState<ItemRequest | null>(null)
  const [excReq, setExcReq] = useState<ExcursionRequest | null>(null)
  const [lastItem, setLastItem] = useState<string | null>(null)
  const Recognition = typeof window === 'undefined' ? null : speechRecognitionOf(window)
  const listen = () => {
    if (!Recognition) return
    const r = new Recognition() as { lang: string; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; start: () => void }
    r.lang = 'en-US'
    r.onresult = (e) => setText(e.results[0]?.[0]?.transcript?.slice(0, 200) ?? '')
    r.start()
  }

  /** Asks the server's concierge; it answers from the guest's own plan, checklist and bill, and sends anything needing a person to the right desk. */
  const askServer = async (q: string) => {
    setBusy(true)
    const user = { id: `u-${now}`, role: 'user' as const, text: q, at: now }
    const turn = await ask(sendConcierge, [user], { sailingId: sailing.id, personaId: me?.id ?? '', now })
    const answer: Answer = turn.handoff
      ? { text: t(`ai.handoff.${turn.handoff}` as StringKey, { phone: GUEST_SERVICES_NUMBER, emergency: EMERGENCY_NUMBER }), sources: [] }
      : { text: turn.reply.text, sources: turn.reply.citations }
    setTurns((all) => [{ id: all.length, question: q, answer }, ...all])
    setBusy(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q) return
    setNotice(null)
    setText('')
    const item = parseItemRequest(q)
    if (item && !me?.child) { setProposal(null); setItemReq(item); return }
    setItemReq(null)
    const exc = parseExcursionRequest(q)
    if (exc && me && !me.child) { setProposal(null); setExcReq(exc); return }
    setExcReq(null)
    if (CHANGE_WORDS.test(q)) {
      const r = requestChange(q, dp.rows, dp.alternatives, now, day)
      if (r.ok) { setProposal(r.change); return }
      setProposal(null)
      setTurns((all) => [{ id: all.length, question: q, answer: { text: t(r.reason === 'nothing' ? 'ask.cantFind' : 'ask.unclear'), sources: [] } }, ...all])
      return
    }
    setProposal(null)
    void askServer(q)
  }

  const confirm = () => {
    if (!proposal) return
    const next = addProposal(dp.changes, proposal)
    const r = acceptChange(dp.base, next, proposal.id, now)
    if (r.ok) {
      void programmeFollows(api.onboard, dp.sailing, pilot.prefs, dp.changes, r.changes.filter((c) => c.day === day))
      update((s) => ({ ...s, changes: [...s.changes.filter((c) => c.day !== day), ...r.changes] }))
      setNotice('ask.done')
    } else setNotice(REFUSED[r.reason])
    setProposal(null)
  }

  const confirmItem = async () => {
    if (!itemReq) return
    try {
      const rows = await api.aboard.requests.create(itemReq.id, itemReq.qty, '')
      setLastItem(rows.reduce((a, b) => (b.placedAt >= a.placedAt ? b : a)).id)
      setNotice('ask.itemDone')
    } catch {
      setNotice('ask.itemFail')
    }
    setItemReq(null)
  }
  const confirmExcursion = async () => {
    if (!excReq || !me) return
    try { await api.plan.excursions.addToCart(excReq.id, [me.id]); setNotice('ask.excDone') } catch { setNotice('ask.excFail') }
    setExcReq(null)
  }
  const undoItem = async () => {
    if (!lastItem) return
    try { await api.aboard.requests.cancel(lastItem); setNotice('ask.itemUndone') } catch { setNotice('ask.itemFail') }
    setLastItem(null)
  }

  return (
    <div className="page">
      <h1>{t('route.ask')}</h1>
      <p>{t('ask.intro')}</p>
      <p className="muted">{t('ask.promise')}</p>
      <form onSubmit={submit}>
        <Field label={t('ask.label')} hint={t('ask.hint')} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" disabled={busy}>{t('ask.send')}</Button>
        {Recognition && <Button variant="secondary" onClick={listen}>{t('ask.speak')}</Button>}
      </form>
      {Recognition && <p className="muted">{t('ask.speakNote')}</p>}
      <ul className="plain-list" aria-label={t('ask.examples')}>
        {EXAMPLES.map((q) => <li key={q}><Button variant="tertiary" disabled={busy} onClick={() => void askServer(q)}>{q}</Button></li>)}
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
      {itemReq && (
        <Card labelledBy="ask-item">
          <h2 id="ask-item" className="card__title">{t('ask.itemPreview')}</h2>
          <p><strong>{t('ask.itemWhat', { qty: itemReq.qty, item: t(`req.i.${itemReq.id}` as StringKey) })}</strong></p>
          <p>{t('req.usually', { minutes: requestItem(itemReq.id)!.etaMin })}</p>
          <p className="muted">{t('ask.itemUndo')}</p>
          <div className="button-row">
            <Button onClick={() => void confirmItem()}>{t('ask.confirm')}</Button>
            <Button variant="secondary" onClick={() => setItemReq(null)}>{t('ask.cancel')}</Button>
          </div>
        </Card>
      )}
      {excReq && (
        <Card labelledBy="ask-exc">
          <h2 id="ask-exc" className="card__title">{t('ask.excPreview')}</h2>
          <p><strong>{t('ask.excWhat', { name: excReq.name })}</strong></p>
          <p className="muted">{t('ask.excNote')}</p>
          <div className="button-row">
            <Button onClick={() => void confirmExcursion()}>{t('ask.confirm')}</Button>
            <Button variant="secondary" onClick={() => setExcReq(null)}>{t('ask.cancel')}</Button>
          </div>
        </Card>
      )}
      {lastItem && notice === 'ask.itemDone' && <Button variant="secondary" onClick={() => void undoItem()}>{t('ask.itemUndoButton')}</Button>}
      {notice && <Banner kind="info" title={t(notice)}>{notice === 'ask.done' && <p><Link to="/plan/autopilot">{t('ask.seeLog')}</Link></p>}{notice === 'ask.excDone' && <p><Link to="/plan/excursions">{t('ask.excGo')}</Link></p>}</Banner>}

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
