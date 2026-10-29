import { useState } from 'react'
import { Link } from 'react-router'
import { FIX_FLOWS, type FixFlow } from '../../domain/readiness'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { TextArea } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { formatDateTime } from '../account/format'
import { AheadError, Back, ChildNote } from './common'

function Flow({ flow, reload }: { flow: FixFlow; reload: () => void }) {
  const [done, setDone] = useState<string[]>([])
  const [stuck, setStuck] = useState(false)
  const [note, setNote] = useState('')
  const send = useAction(async () => { await api.ahead.fix.escalate(flow.id, note); setNote(''); setStuck(false); reload() })
  return (
    <Card>
      <h3 className="card__title">{flow.title}</h3>
      <ol className="plain-bullets">
        {flow.steps.map((s) => (
          <li key={s.id}>
            <label className="choice choice--top">
              <input type="checkbox" checked={done.includes(s.id)} onChange={(e) => setDone(e.target.checked ? [...done, s.id] : done.filter((x) => x !== s.id))} />
              <span>{s.text}{s.link && <> <Link to={s.link}>{t('fix.open')}</Link></>}</span>
            </label>
          </li>
        ))}
      </ol>
      {done.length === flow.steps.length && !stuck && (
        <div className="button-row">
          <p role="status">{t('fix.allDone')}</p>
          <Button variant="secondary" onClick={() => setStuck(true)}>{t('fix.stillStuck')}</Button>
        </div>
      )}
      {done.length < flow.steps.length && !stuck && <Button variant="tertiary" onClick={() => setStuck(true)}>{t('fix.skip')}</Button>}
      {stuck && (
        <form onSubmit={(e) => { e.preventDefault(); void send.run() }}>
          <TextArea label={t('fix.note')} hint={t('fix.noteHint')} value={note} maxLength={600} onChange={(e) => setNote(e.target.value)} />
          <AheadError error={send.error} />
          <Button type="submit" disabled={send.busy}>{t('fix.send')}</Button>
        </form>
      )}
    </Card>
  )
}

/** Guided self-service for the commonest problems, with a case when the steps do not help (MNG-18). */
export function FixItScreen() {
  const cases = useMine(() => api.ahead.fix.list())
  return (
    <div className="page">
      <h1>{t('route.fixIt')}</h1>
      <p>{t('fix.intro')}</p>
      <ChildNote />
      <ul className="card-grid">{FIX_FLOWS.map((f) => <li key={f.id}><Flow flow={f} reload={cases.retry} /></li>)}</ul>
      <h2>{t('fix.yours')}</h2>
      <Load state={cases}>
        {(rows) => rows.length === 0 ? <p className="muted">{t('fix.none')}</p> : (
          <ul className="card-grid">
            {rows.map((r) => (
              <li key={r.id}>
                <Card>
                  <h3 className="card__title">{FIX_FLOWS.find((f) => f.id === r.flow)?.title} · {r.reference}</h3>
                  <p><StatusBadge kind={r.stage === 'contacted' ? 'booked' : 'waitlist'} label={t(`fix.stage.${r.stage}` as StringKey)} /></p>
                  <p className="muted">{t('fix.contactBy', { time: formatDateTime(r.contactBy) })}</p>
                  <p>{r.note}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Load>
      <p><Link to="/me/help">{t('route.helpCentre')}</Link> · <Link to="/me/contact">{t('route.contact')}</Link></p>
      <Back to="/me" label={t('route.me')} />
    </div>
  )
}
