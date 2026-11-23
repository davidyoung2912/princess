import { useState } from 'react'
import { Link } from 'react-router'
import { undoOpen, type StanleyReceipt } from '../../stanley/logic/stanleyActivity'
import { useNow } from '../../../shared/hooks/useDemo'
import { useStanleyActivity, type ActivityFailure } from '../../../shared/hooks/useStanleyActivity'
import { t, th, type StringKey, headingCase } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { useShipTime } from '../../onboard/ui/shipTime'

/**
 * Stanley activity (docs/stanley-actions-and-proactive-plan.md, phase P1): what he did, with a receipt of six fields for each, what he is watching, and what he remembers, each with its own stop button.
 * Everything is the server's copy; the app holds no list of its own and keeps nothing on the device.
 */
export function StanleyActivityScreen() {
  const a = useStanleyActivity()
  const shipTime = useShipTime()
  const now = useNow()
  const [confirmAll, setConfirmAll] = useState(false)
  const { activity } = a
  if (!activity) {
    return (
      <div className="page">
        <p role="status">{a.failure === 'load' ? t('stanleyActivity.error.load') : t('stanleyActivity.loading')}</p>
        {a.failure === 'load' ? <div className="button-row"><Button variant="secondary" onClick={() => { void a.retry() }}>{t('stanleyActivity.retry')}</Button></div> : null}
      </div>
    )
  }
  const open = activity.did.filter((d) => undoOpen(d, now)).length
  const problem = (f: ActivityFailure | null) => (f && f !== 'load' ? <p role="alert" className="field__error">{t(`stanleyActivity.error.${f}` as StringKey)}</p> : null)
  return (
    <div className="page">
      <p>{t('stanleyActivity.intro')}</p>
      {problem(a.failure)}
      {a.note ? <p role="status">{t('stanleyActivity.undoneAll', { undone: a.note.undone, kept: a.note.kept })}</p> : null}

      <Card hero labelledBy="stanley-act-pause-h">
        <h2 id="stanley-act-pause-h">{th('stanleyAuthority.pause.title')}</h2>
        {activity.paused ? <p role="status">{t('stanleyAuthority.pause.on')}</p> : <p>{t('stanleyAuthority.pause.intro')}</p>}
        <div className="button-row">
          {activity.paused
            ? <Button disabled={a.busy} onClick={() => { void a.resume() }}>{t('stanleyAuthority.pause.resume')}</Button>
            : <Button variant="secondary" disabled={a.busy} onClick={() => { void a.pause() }}>{t('stanleyAuthority.pause.all')}</Button>}
        </div>
      </Card>

      <Card labelledBy="stanley-act-did-h">
        <h2 id="stanley-act-did-h">{th('stanleyActivity.did.title')}</h2>
        {activity.did.length === 0 ? <p>{t('stanleyActivity.did.none')}</p> : (
          <>
            {open > 0 && (
              <div className="button-row">
                {confirmAll
                  ? <>
                      <Button disabled={a.busy} onClick={() => { setConfirmAll(false); void a.undoAll() }}>{t('stanleyActivity.undoAll.confirm', { count: open })}</Button>
                      <Button variant="tertiary" onClick={() => setConfirmAll(false)}>{t('stanleyActivity.undoAll.keep')}</Button>
                    </>
                  : <Button variant="secondary" disabled={a.busy} onClick={() => setConfirmAll(true)}>{t('stanleyActivity.undoAll.ask', { count: open })}</Button>}
              </div>
            )}
            <ul className="stanley-activity__list">
              {activity.did.map((r, i) => <Receipt key={r.id} r={r} when={shipTime(r.at)} defaultOpen={i === 0} canUndo={undoOpen(r, now)} busy={a.busy} onUndo={() => { void a.undo(r.id) }} />)}
            </ul>
          </>
        )}
      </Card>

      <Card labelledBy="stanley-act-watch-h">
        <h2 id="stanley-act-watch-h">{th('stanleyActivity.watching.title')}</h2>
        {activity.paused ? <p className="muted">{t('stanleyActivity.watching.paused')}</p> : activity.watching.length === 0 ? <p>{t('stanleyActivity.watching.none')}</p> : (
          <ul className="stanley-activity__list">
            {activity.watching.map((w) => (
              <li key={w.id}>
                <p><strong>{w.wording}</strong></p>
                <p className="muted">{w.never}</p>
                <div className="button-row"><Button variant="secondary" disabled={a.busy} onClick={() => { void a.stopWatch(w.id) }} aria-label={t('stanleyActivity.watching.stopFor', { what: w.wording })}>{t('stanleyActivity.watching.stop')}</Button></div>
              </li>
            ))}
          </ul>
        )}
        <p><Link to="/me/settings">{t('stanleyActivity.watching.more')}</Link></p>
      </Card>

      <Card labelledBy="stanley-act-mem-h">
        <h2 id="stanley-act-mem-h">{th('stanleyActivity.remembers.title')}</h2>
        {!activity.remembers.enabled ? <p>{t('stanleyActivity.remembers.off')}</p> : activity.remembers.items.length === 0 ? <p>{t('stanleyActivity.remembers.none')}</p> : (
          <ul className="stanley-activity__list">
            {activity.remembers.items.map((m) => (
              <li key={m.id}>
                <p><strong>{m.text}</strong></p>
                {m.reason ? <p className="muted">{m.reason}</p> : null}
                <div className="button-row"><Button variant="secondary" disabled={a.busy} onClick={() => { void a.forget(m.id) }} aria-label={t('stanleyActivity.remembers.forgetFor', { what: m.text })}>{t('stanleyActivity.remembers.forget')}</Button></div>
              </li>
            ))}
          </ul>
        )}
        {activity.remembers.count > activity.remembers.items.length ? <p className="muted">{t('stanleyActivity.remembers.more', { count: activity.remembers.count - activity.remembers.items.length })}</p> : null}
      </Card>

      <p><Link to="/me/stanley-can">{t('stanleyCan.link')}</Link></p>
    </div>
  )
}

/** One receipt. The six fields sit under "Why did you do that?", open for the newest so the last act is explained without a tap. */
function Receipt({ r, when, defaultOpen, canUndo, busy, onUndo }: { r: StanleyReceipt; when: string; defaultOpen: boolean; canUndo: boolean; busy: boolean; onUndo: () => void }) {
  return (
    <li id={`stanley-receipt-${r.id}`}>
      <p><strong>{r.what}</strong> <span className="muted">· {t(`stanleyActivity.status.${r.status}` as StringKey)} · {when} · {r.number}</span></p>
      <details open={defaultOpen}>
        <summary>{headingCase(t('stanleyActivity.why'))}</summary>
        <dl>
          <dt>{t('stanleyActivity.field.why')}</dt><dd>{r.why}</dd>
          <dt>{t('stanleyActivity.field.facts')}</dt><dd>{r.facts} <span className="muted">{when}</span></dd>
          <dt>{t('stanleyActivity.field.affects')}</dt><dd>{r.affects}</dd>
          <dt>{t('stanleyActivity.field.undo')}</dt><dd>{r.undo}</dd>
          <dt>{t('stanleyActivity.field.stop')}</dt><dd>{r.stop}</dd>
        </dl>
      </details>
      {canUndo ? <div className="button-row"><Button variant="secondary" disabled={busy} onClick={onUndo} aria-label={t('stanleyActivity.undoFor', { what: r.what })}>{t('stanleyActivity.undo')}</Button></div> : null}
    </li>
  )
}
