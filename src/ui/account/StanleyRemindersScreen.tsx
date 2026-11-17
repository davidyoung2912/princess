import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { upcomingFromCache } from '../../ai/stanleyOffline'
import { normalizeAction, planSnapshot, type StanleyAction } from '../../ai/stanleyAction'
import { editTime, groupReminders, LEAD_CHOICES, reminderContext, reminderShare, type StanleyReminder } from '../../ai/stanleyReminders'
import { useOnline } from '../../hooks/useOnline'
import { useNow } from '../../hooks/useDemo'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useStanleyReminders, type ReminderFailure } from '../../hooks/useStanleyReminders'
import { t, th, type StringKey } from '../../i18n'
import { stanleyActions } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { useShipTime } from '../onboard/shipTime'
import { StanleyActionCard } from '../ai/StanleyActionCard'

/**
 * My reminders (docs/stanley-reminders-requirements.md, phases R1 and R2): everything the guest asked Stanley to remind them of, in ship time, with what each follows. A reminder that follows a plan item or all aboard moves
 * when it moves, and the line saying so is shown here. Everything is the server's copy; the plan is sent so the server can follow it.
 */
export function StanleyRemindersScreen() {
  const day = useCurrentDay()
  const dp = useDayPlan(day)
  const allAboard = dp.itineraryDay.allAboard ?? null
  const context = useMemo(() => (dp.ready ? reminderContext(planSnapshot(dp.rows, dp.alternatives, day), allAboard, dp.sailing.id) : undefined), [dp.ready, dp.rows, dp.alternatives, day, allAboard, dp.sailing.id])
  const r = useStanleyReminders(context)
  const [editing, setEditing] = useState<string | null>(null)
  const online = useOnline()
  const now = useNow()
  const time = useShipTime()

  if (!r.list && r.failure === 'load' && !online) {
    const up = upcomingFromCache(r.copy, now)
    return (
      <div className="page">
        <p role="status">{r.copy ? t('stanleyOffline.copyNote', { checked: time(r.copy.cachedAt) }) : t('stanleyOffline.copyNone')}</p>
        {up.length > 0 && (
          <ul className="stanley-reminders__list">
            {up.map((x) => (
              <li key={x.id} className="stanley-reminders__item">
                <p><strong>{x.text}</strong></p>
                <p>{x.when || time(x.dueAt)}</p>
                {x.mayHaveMoved && r.copy ? <p className="muted">{t('stanleyOffline.mayHaveMoved', { checked: time(r.copy.cachedAt) })}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  if (!r.list) {
    return (
      <div className="page">
        <p role="status">{r.failure === 'load' ? t('stanleyReminders.error.load') : t('stanleyReminders.loading')}</p>
        {r.failure === 'load' ? <div className="button-row"><Button variant="secondary" onClick={() => { void r.retry() }}>{t('stanleyReminders.retry')}</Button></div> : null}
      </div>
    )
  }
  const { upcoming, ended } = groupReminders(r.list)
  const problem = (f: ReminderFailure | null) => (f && f !== 'load' ? <p role="alert" className="field__error">{t(`stanleyReminders.error.${f}` as StringKey)}</p> : null)
  return (
    <div className="page">
      <p>{t('stanleyReminders.intro')}</p>
      {problem(r.failure)}
      <AddReminder />

      <Card labelledBy="stanley-rem-up-h">
        <h2 id="stanley-rem-up-h">{th('stanleyReminders.upcoming')}</h2>
        {upcoming.length === 0 ? <p>{t('stanleyReminders.none')}</p> : (
          <ul className="stanley-reminders__list">
            {upcoming.map((x) => <Item key={x.id} item={x} editing={editing === x.id} busy={r.busy} onEdit={() => setEditing(editing === x.id ? null : x.id)}
              onSave={async (body) => { if (await r.edit(x.id, body)) setEditing(null) }} onRemove={() => { void r.remove(x.id) }} />)}
          </ul>
        )}
      </Card>

      {ended.length > 0 && (
        <Card labelledBy="stanley-rem-end-h">
          <h2 id="stanley-rem-end-h">{th('stanleyReminders.ended')}</h2>
          <ul className="stanley-reminders__list">
            {ended.map((x) => <Item key={x.id} item={x} editing={false} busy={r.busy} onEdit={() => undefined} onSave={async () => undefined} onRemove={() => { void r.remove(x.id) }} onKeep={() => { void r.edit(x.id, { keepAsClock: true }) }} />)}
          </ul>
        </Card>
      )}
      <p><Link to="/me/notifications">{t('stanleyReminders.settings')}</Link></p>
    </div>
  )
}

/** The form for a reminder at a clock time: the server reads it, shows what it will do, and nothing is set until the guest confirms. */
function AddReminder() {
  const [what, setWhat] = useState('')
  const [date, setDate] = useState('')
  const [at, setAt] = useState('')
  const [prepared, setPrepared] = useState<StanleyAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const time = editTime(at, date || '1970-01-01')
  const ask = async () => {
    if (!time) return
    setBusy(true); setFailed(false)
    try {
      const args: Record<string, string> = { at: time.at, text: what.trim() || t('stanleyReminders.defaultText') }
      if (date) args.date = date
      const a = normalizeAction(await stanleyActions.prepare({ kind: 'remind_me', args }))
      setPrepared(a); setFailed(a === null)
    } catch { setFailed(true) }
    setBusy(false)
  }
  return (
    <Card labelledBy="stanley-rem-add-h">
      <h2 id="stanley-rem-add-h">{th('stanleyReminders.add.title')}</h2>
      {prepared ? (
        <div role="status">
          <StanleyActionCard action={prepared} onChange={setPrepared} />
          <div className="button-row"><Button variant="tertiary" onClick={() => { setPrepared(null); setWhat(''); setAt(''); setDate('') }}>{t('stanleyReminders.add.another')}</Button></div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void ask() }}>
          <Field label={t('stanleyReminders.add.what')} maxLength={80} value={what} onChange={(e) => setWhat(e.target.value)} />
          <Field label={t('stanleyReminders.add.date')} hint={t('stanleyReminders.add.dateHint')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label={t('stanleyReminders.add.time')} type="time" value={at} onChange={(e) => setAt(e.target.value)} />
          {failed && <p role="alert" className="field__error">{t('stanleyReminders.add.failed')}</p>}
          <div className="button-row"><Button type="submit" disabled={busy || !time}>{t('stanleyReminders.add.preview')}</Button></div>
        </form>
      )}
    </Card>
  )
}

interface ItemProps {
  item: StanleyReminder
  editing: boolean
  busy: boolean
  onEdit: () => void
  onSave: (body: { text?: string; at?: string; date?: string; leadMin?: number }) => Promise<void>
  onRemove: () => void
  onKeep?: () => void
}

/** The phone's share sheet with the reminder's words and a calendar file; with no share sheet (a desktop), the calendar file is saved instead. Nothing is sent by Princess. */
async function shareReminder(item: StanleyReminder): Promise<void> {
  const s = reminderShare(item)
  const file = new File([s.ics], s.fileName, { type: 'text/calendar' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) { await nav.share({ title: s.title, text: s.text, files: [file] }); return }
    if (typeof nav.share === 'function') { await nav.share({ title: s.title, text: s.text }); return }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = s.fileName
  a.click()
  URL.revokeObjectURL(url)
}

function Item({ item, editing, busy, onEdit, onSave, onRemove, onKeep }: ItemProps) {
  const ended = item.state === 'cancelled'
  return (
    <li className="stanley-reminders__item">
      <p><strong>{item.text}</strong>{item.private ? <span className="muted"> ({t('stanleyReminders.private')})</span> : null}</p>
      <p className={ended ? 'muted' : undefined}>{ended ? t('stanleyReminders.off', { when: item.when }) : item.past ? t('stanleyReminders.past', { when: item.when }) : item.when}</p>
      {item.anchor && item.lead ? <p className="muted">{t('stanleyReminders.follows', { lead: item.lead, anchor: item.anchor })}</p> : null}
      {item.note ? <p role="status">{item.note}</p> : null}
      <div className="button-row">
        {ended && onKeep ? <Button variant="secondary" disabled={busy} onClick={onKeep}>{t('stanleyReminders.keep')}</Button> : null}
        {!ended && !item.past ? <Button variant="tertiary" aria-expanded={editing} onClick={onEdit}>{t('stanleyReminders.edit')}<span className="visually-hidden"> {item.text}</span></Button> : null}
        {!ended && !item.past ? <Button variant="tertiary" onClick={() => { void shareReminder(item) }}>{t('stanleyReminders.share')}<span className="visually-hidden"> {item.text}</span></Button> : null}
        <Button variant="tertiary" disabled={busy} onClick={onRemove}>{t('stanleyReminders.remove')}<span className="visually-hidden"> {item.text}</span></Button>
      </div>
      {editing ? <EditForm item={item} busy={busy} onSave={onSave} onCancel={onEdit} /> : null}
    </li>
  )
}

function EditForm({ item, busy, onSave, onCancel }: { item: StanleyReminder; busy: boolean; onSave: ItemProps['onSave']; onCancel: () => void }) {
  const leadId = useId()
  const [text, setText] = useState(item.text)
  const [date, setDate] = useState('')
  const [at, setAt] = useState('')
  const [lead, setLead] = useState('')
  const anchored = item.kind === 'anchored'
  const time = date && at ? editTime(at, date) : null
  const changed = text.trim() !== item.text || time !== null || lead !== ''
  const save = () => {
    const body: Parameters<ItemProps['onSave']>[0] = {}
    if (text.trim() !== item.text) body.text = text.trim()
    if (anchored && lead !== '') body.leadMin = Number(lead)
    if (!anchored && time) { body.at = time.at; body.date = time.date }
    void onSave(body)
  }
  return (
    <form className="stanley-reminders__edit" onSubmit={(e) => { e.preventDefault(); if (changed && text.trim()) save() }}>
      <Field label={t('stanleyReminders.add.what')} maxLength={80} value={text} onChange={(e) => setText(e.target.value)} />
      {anchored ? (
        <div className="field">
          <label htmlFor={leadId}>{t('stanleyReminders.leadLabel')}</label>
          <select id={leadId} className="field__input" value={lead} onChange={(e) => setLead(e.target.value)}>
            <option value="">{t('stanleyReminders.keepLead', { lead: item.lead ?? '' })}</option>
            {LEAD_CHOICES.map((m) => <option key={m} value={m}>{t('remindMe.minutesBefore', { count: m })}</option>)}
          </select>
        </div>
      ) : (
        <>
          <Field label={t('stanleyReminders.newDate')} hint={t('stanleyReminders.newTimeHint')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label={t('stanleyReminders.newTime')} type="time" value={at} onChange={(e) => setAt(e.target.value)} />
        </>
      )}
      <div className="button-row">
        <Button type="submit" disabled={busy || !changed || !text.trim()}>{t('stanleyReminders.save')}</Button>
        <Button variant="tertiary" onClick={onCancel}>{t('stanleyReminders.cancel')}</Button>
      </div>
    </form>
  )
}
