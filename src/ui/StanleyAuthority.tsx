import { useState } from 'react'
import { canSwitch, countRows, rowsOf } from '../ai/stanleyPermissions'
import { useStanleyPermissions, type Failure } from '../hooks/useStanleyPermissions'
import { headingCase, t, th, type StringKey } from '../i18n'
import { Button } from './Button'
import { Card } from './Card'
import { Field } from './Field'

const GROUPS = ['watching', 'preparing', 'handling'] as const

const when = (at: number): string => new Date(at).toISOString().slice(0, 16).replace('T', ' ')

/**
 * How much Stanley may do on his own: the four levels and the checklist, from the server (docs/stanley-actions-and-proactive-plan.md, 11.2 and 11.3). Used by the welcome page and Settings. A level or row that
 * does not work yet says so and cannot be chosen, so nothing is promised that Stanley does not do. `full` (Settings) adds Pause everything and the history of what the guest agreed to.
 */
export function StanleyAuthority({ source, full = false }: { source: 'welcome' | 'settings'; full?: boolean }) {
  const p = useStanleyPermissions(source)
  const [code, setCode] = useState('')
  const { perms } = p
  if (!perms) {
    return (
      <Card labelledBy="stanley-authority-h">
        <h2 id="stanley-authority-h">{th('stanleyAuthority.title')}</h2>
        <p role="status">{p.failure === 'load' ? t('stanleyAuthority.error.load') : t('stanleyAuthority.loading')}</p>
      </Card>
    )
  }
  const counts = countRows(perms)
  const chosen = perms.levels.find((l) => l.id === perms.level)
  const failure = (f: Failure | null) => (f ? <p role="alert" className="field__error">{t(`stanleyAuthority.error.${f}` as StringKey)}</p> : null)
  return (
    <>
      <Card hero labelledBy="stanley-authority-h">
        <h2 id="stanley-authority-h">{th('stanleyAuthority.title')}</h2>
        <p>{t('stanleyAuthority.intro')}</p>
        <fieldset disabled={p.busy || perms.childLimited}>
          <legend>{t('stanleyAuthority.legend')}</legend>
          {[...perms.levels].reverse().map((l) => (
            <label key={l.id} className="choice">
              <input type="radio" name={`stanley-authority-${source}`} checked={perms.level === l.id} disabled={!l.available && perms.level !== l.id} onChange={() => { void p.setLevel(l.id) }} />
              <span><strong>{l.name}</strong>{l.id === 4 ? ` (${t('stanleyAuthority.recommended')})` : ''}. {l.line}</span>
            </label>
          ))}
        </fieldset>
        {perms.childLimited ? <p className="muted">{t('stanleyAuthority.child')}</p> : null}
        {perms.voiceLimited ? <p className="muted">{t('stanleyAuthority.voiceLimited')}</p> : null}
        {failure(p.failure)}
        {p.stepUp !== 'none' && (
          <div role="group" aria-labelledby="stanley-stepup-h" className="stanley-authority__stepup">
            <h3 id="stanley-stepup-h">{th('stanleyAuthority.stepup.title')}</h3>
            <p>{t('stanleyAuthority.stepup.body')}</p>
            {p.stepUp === 'sent' && (
              <Field label={t('stanleyAuthority.stepup.code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            )}
            <div className="button-row">
              {p.stepUp === 'ask'
                ? <Button disabled={p.busy} onClick={() => { void p.sendCode() }}>{t('stanleyAuthority.stepup.send')}</Button>
                : <Button disabled={p.busy || code.length !== 6} onClick={() => { void p.verify(code).then(() => setCode('')) }}>{t('stanleyAuthority.stepup.confirm')}</Button>}
              <Button variant="tertiary" onClick={() => { setCode(''); p.cancelStepUp() }}>{t('stanleyAuthority.stepup.cancel')}</Button>
            </div>
          </div>
        )}
      </Card>
      <Card labelledBy="stanley-checklist-h">
        <h2 id="stanley-checklist-h">{th('stanleyAuthority.checklist')}</h2>
        <p>{t('stanleyAuthority.checklist.intro')}</p>
        {GROUPS.map((g) => {
          const rows = rowsOf(perms, g)
          return rows.length === 0 ? null : (
            <section key={g} aria-labelledby={`stanley-group-${g}`}>
              <h3 id={`stanley-group-${g}`}>{headingCase(t(`stanleyAuthority.group.${g}` as StringKey))}</h3>
              <ul className="stanley-authority__rows">
                {rows.map((r) => (
                  <li key={r.id}>
                    <label className="choice">
                      <input type="checkbox" checked={r.state === 'on'} disabled={p.busy || perms.childLimited || !canSwitch(r)} onChange={(e) => { void p.setRow(r.id, e.target.checked) }} />
                      <span>{r.wording}</span>
                    </label>
                    <p className="muted">{t('stanleyAuthority.example', { example: r.example })} {r.never}</p>
                    {r.state === 'needsLevel' ? <p className="muted">{t('stanleyAuthority.needsLevel', { level: r.needsLevel })}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        <p role="status">{t('stanleyAuthority.summary', { level: chosen?.name ?? '', on: counts.on, off: counts.off })}</p>
      </Card>
      {full && (
        <Card labelledBy="stanley-pause-h">
          <h2 id="stanley-pause-h">{th('stanleyAuthority.pause.title')}</h2>
          {perms.paused ? <p role="status">{t('stanleyAuthority.pause.on')}</p> : <p>{t('stanleyAuthority.pause.intro')}</p>}
          <div className="button-row">
            {perms.paused
              ? <Button disabled={p.busy} onClick={() => { void p.resume() }}>{t('stanleyAuthority.pause.resume')}</Button>
              : <>
                  <Button variant="secondary" disabled={p.busy || perms.childLimited} onClick={() => { void p.pause('forever') }}>{t('stanleyAuthority.pause.all')}</Button>
                  <Button variant="tertiary" disabled={p.busy || perms.childLimited} onClick={() => { void p.pause('today') }}>{t('stanleyAuthority.pause.today')}</Button>
                </>}
          </div>
          <h3>{th('stanleyAuthority.history.title')}</h3>
          {p.history === null
            ? <div className="button-row"><Button variant="tertiary" onClick={p.loadHistory}>{t('stanleyAuthority.history.show')}</Button></div>
            : p.history.length === 0
              ? <p className="muted">{t('stanleyAuthority.history.none')}</p>
              : <ul>{p.history.map((h, i) => <li key={`${h.at}-${i}`}>{t('stanleyAuthority.history.line', { what: h.ability === 'level' ? t('stanleyAuthority.history.level') : h.ability === 'pause' ? t('stanleyAuthority.history.pause') : h.ability, state: h.state, source: h.source, when: when(h.at) })}</li>)}</ul>}
        </Card>
      )}
    </>
  )
}
