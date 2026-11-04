import { useState } from 'react'
import { Link } from 'react-router'
import { parseExcursionRequest, parseItemRequest, type ExcursionRequest, type ItemRequest } from '../../domain/finishMore'
import { requestItem } from '../../domain/services'
import { acceptChange, addProposal, requestChange, type Change } from '../../domain/planChange'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useNow, usePersona } from '../../hooks/useDemo'
import { usePilot } from '../../hooks/usePilot'
import { programmeFollows } from '../../pilot/programme'
import { t, th, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { REFUSED } from '../plan/refused'
import { useShipTime } from '../onboard/shipTime'
import { isActionRequest } from '../../ai/stanleyRoute'

/**
 * The confirm step for anything that changes the trip (XA-02, SG7): a request to move, add, order or book is shown as a preview and only happens when the guest presses Confirm.
 * Used inside Stanley's dialog and on Ask your cruise. Nothing here runs by itself: every change starts from a button the guest presses, and a change to the plan can be undone for two hours.
 */
export function StanleyConfirm({ question, onNavigate }: { question: string; onNavigate?: () => void }) {
  const now = useNow()
  const time = useShipTime()
  const me = usePersona()
  const day = useCurrentDay()
  const dp = useDayPlan(day)
  const { state: pilot, update } = usePilot()
  // What the words ask for is worked out once, when the card first shows.
  const [start] = useState(() => {
    const q = question.trim()
    const item = parseItemRequest(q)
    if (item && !me?.child) return { item, exc: null, proposal: null, message: null as StringKey | null }
    const exc = parseExcursionRequest(q)
    if (exc && me && !me.child) return { item: null, exc, proposal: null, message: null as StringKey | null }
    if (isActionRequest(q) && !dp.ready) return { item: null, exc: null, proposal: null, message: 'feed.waiting' as StringKey }
    if (isActionRequest(q)) {
      const r = requestChange(q, dp.rows, dp.alternatives, now, day)
      return r.ok ? { item: null, exc: null, proposal: r.change, message: null as StringKey | null } : { item: null, exc: null, proposal: null, message: (r.reason === 'nothing' ? 'ask.cantFind' : 'ask.unclear') as StringKey }
    }
    return { item: null, exc: null, proposal: null, message: 'ask.unclear' as StringKey }
  })
  const [proposal, setProposal] = useState<Change | null>(start.proposal)
  const [itemReq, setItemReq] = useState<ItemRequest | null>(start.item)
  const [excReq, setExcReq] = useState<ExcursionRequest | null>(start.exc)
  const [notice, setNotice] = useState<StringKey | null>(start.message)
  const [lastItem, setLastItem] = useState<string | null>(null)

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
    <div className="stanley__confirm">
      {proposal && (
        <Card labelledBy="ask-prop">
          <h2 id="ask-prop" className="card__title">{th('ask.preview')}</h2>
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
          <h2 id="ask-item" className="card__title">{th('ask.itemPreview')}</h2>
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
          <h2 id="ask-exc" className="card__title">{th('ask.excPreview')}</h2>
          <p><strong>{t('ask.excWhat', { name: excReq.name })}</strong></p>
          <p className="muted">{t('ask.excNote')}</p>
          <div className="button-row">
            <Button onClick={() => void confirmExcursion()}>{t('ask.confirm')}</Button>
            <Button variant="secondary" onClick={() => setExcReq(null)}>{t('ask.cancel')}</Button>
          </div>
        </Card>
      )}
      {lastItem && notice === 'ask.itemDone' && <Button variant="secondary" onClick={() => void undoItem()}>{t('ask.itemUndoButton')}</Button>}
      {notice && <Banner kind="info" title={t(notice)}>{notice === 'ask.done' && <p><Link to="/plan/autopilot" onClick={onNavigate}>{t('ask.seeLog')}</Link></p>}{notice === 'ask.excDone' && <p><Link to="/plan/excursions" onClick={onNavigate}>{t('ask.excGo')}</Link></p>}</Banner>}
    </div>
  )
}
