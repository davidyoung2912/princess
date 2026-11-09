import { useState } from 'react'
import { noticedItems, noticedMobility, toldRequest, tripItems, type MemoryItem, type MemoryKind, type MemoryScope, type RememberRequest } from '../../ai/stanleyMemory'
import type { Inference } from '../../domain/planning'
import { formatDate } from '../../domain/cruise'
import { useSailing } from '../../hooks/useDemo'
import { useStanleyMemory } from '../../hooks/useStanleyMemory'
import { t, th, type StringKey } from '../../i18n'
import { stanleyMemory } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

const scopeLabel = (s: MemoryScope): string => t(s === 'trip' ? 'memory7.scope.trip' : 'memory7.scope.future')

/**
 * What Stanley remembers (phase 7): each kept preference with its reason and scope, a way to carry it to future trips or forget it, a switch for memory as a whole, what the device noticed but has not saved,
 * and the booking facts, shown apart and read-only. Forgetting deletes it on the server, so it leaves every device and the next answer.
 */
export function StanleyMemoryPanel({ noticed, mobility, onDismiss }: { noticed: readonly Inference[]; /** What the access page says (any, easy, wheelchair). */ mobility: 'any' | 'easy' | 'wheelchair'; /** The guest says "not this one" to a noticed item; it is not offered again on this device. */ onDismiss: (id: string) => void }) {
  const sailing = useSailing()
  const { state, loaded, failed, change } = useStanleyMemory()
  const [notice, setNotice] = useState('')
  const kindOf = (k: string) => state.kinds.find((x) => x.kind === k)
  const said = (key: StringKey) => (ok: boolean) => { if (ok) setNotice(t(key)) }
  const remember = (req: RememberRequest) => change(() => stanleyMemory.remember(req)).then(said('memory7.saved'))
  const offered = state.enabled ? noticedItems(noticed, state.items) : []
  const offeredMobility = state.enabled ? noticedMobility(mobility, state.items) : null
  return (
    <>
      <Card labelledBy="mem7-switch-h">
        <h2 id="mem7-switch-h" className="card__title">{th('memory7.switch.title')}</h2>
        <label className="choice">
          <input type="checkbox" checked={!state.enabled} onChange={(e) => { const off = e.target.checked; void change(() => stanleyMemory.setEnabled(!off)).then(said(off ? 'memory7.nowOff' : 'memory7.nowOn')) }} />
          <span>{t('memory7.switch.off')}</span>
        </label>
        {!state.enabled && <p role="status">{t('memory7.isOff')}</p>}
      </Card>

      <Card labelledBy="mem7-kept-h">
        <h2 id="mem7-kept-h" className="card__title">{th('memory7.kept.title')}</h2>
        {failed && <p role="alert">{t('memory7.failed')}</p>}
        {loaded && !failed && state.items.length === 0 && <p>{t('memory7.empty')}</p>}
        <ul className="plain-list">
          {state.items.map((i) => (
            <li key={i.id}>
              <strong>{i.text}</strong>
              <span className="muted"> ({scopeLabel(i.scope)}) {i.reason}</span>
              {!kindOf(i.kind)?.multiple && kindOf(i.kind) && (
                <label className="choice">
                  <span>{t('memory7.change')}</span>
                  <select value={i.value} onChange={(e) => { const value = e.target.value; const req = toldRequest(state.kinds, i.kind, value, i.scope, i.sailingId ?? '', i.shared); if (req) void change(() => stanleyMemory.remember(req)).then(said('memory7.updated')) }}>
                    {kindOf(i.kind)!.values.map((v) => <option key={v} value={v}>{t(`memory7.value.${i.kind}.${v}` as StringKey)}</option>)}
                  </select>
                </label>
              )}
              {i.sensitive && (
                <label className="choice">
                  <input type="checkbox" checked={i.shared} onChange={(e) => { const share = e.target.checked; void change(() => stanleyMemory.update(i.id, { share })).then(said('memory7.updated')) }} />
                  <span>{t('memory7.share')}</span>
                </label>
              )}{' '}
              {i.scope === 'trip' && <Button variant="secondary" onClick={() => void change(() => stanleyMemory.update(i.id, { scope: 'future' })).then(said('memory7.carried'))}>{t('memory7.carry')}</Button>}{' '}
              <Button variant="tertiary" onClick={() => void change(() => stanleyMemory.forget(i.id)).then(said('memory7.forgotten'))}>{t('memory7.forget')}</Button>
            </li>
          ))}
        </ul>
        {state.items.length > 1 && <Button variant="danger" onClick={() => void change(() => stanleyMemory.forgetAll()).then(said('memory7.forgottenAll'))}>{t('memory7.forgetAll')}</Button>}
        <p role="status" className="muted">{notice}</p>
      </Card>

      <AddForm kinds={state.kinds} enabled={state.enabled} sailingId={sailing.id} onAdd={(req) => void remember(req)} />

      {offeredMobility && (
        <Card labelledBy="mem7-mob-h">
          <h2 id="mem7-mob-h" className="card__title">{th('memory7.mobility.title')}</h2>
          <p>{t('memory7.mobility.intro', { value: t(`memory7.value.mobility.${offeredMobility.value}` as StringKey) })}</p>
          <Button variant="secondary" onClick={() => void remember({ ...offeredMobility, scope: 'future' })}>{t('memory7.rememberFuture')}</Button>
        </Card>
      )}

      {offered.length > 0 && (
        <Card labelledBy="mem7-noticed-h">
          <h2 id="mem7-noticed-h" className="card__title">{th('memory7.noticed.title')}</h2>
          <p>{t('memory7.noticed.intro')}</p>
          <ul className="plain-list">
            {offered.map(({ inference, request }) => (
              <li key={inference.id}>
                {inference.text} <span className="muted">({t(`taste.from.${inference.source}` as StringKey)})</span>{' '}
                <Button variant="secondary" onClick={() => void remember({ ...request, scope: 'future' })}>{t('memory7.rememberFuture')}</Button>{' '}
                <Button variant="tertiary" onClick={() => void remember({ ...request, scope: 'trip', sailingId: sailing.id })}>{t('memory7.rememberTrip')}</Button>{' '}
                <Button variant="tertiary" onClick={() => onDismiss(inference.id)}>{t('memory7.notThis')}</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card labelledBy="mem7-facts-h">
        <h2 id="mem7-facts-h" className="card__title">{th('memory7.facts.title')}</h2>
        <p>{t('memory7.facts.intro')}</p>
        <ul className="plain-list">
          <li>{t('memory7.facts.sailing', { date: formatDate(sailing.departure) })}</li>
        </ul>
      </Card>
      <p className="muted">{t('memory7.note')}</p>
    </>
  )
}

/**
 * The carry-forward chooser at Remember (STN-REM-07): what Stanley kept for this trip, each with a choice to carry it to the next one. Nothing is carried unless the guest ticks it.
 * Nothing shows when memory is off, empty for this trip or cannot be read.
 */
export function StanleyCarryForward() {
  const sailing = useSailing()
  const { state, change } = useStanleyMemory()
  const [done, setDone] = useState<string[]>([])
  const items = tripItems(state.items, sailing.id)
  if (!state.enabled || (items.length === 0 && done.length === 0)) return null
  const carry = (i: MemoryItem) => change(() => stanleyMemory.update(i.id, { scope: 'future' })).then((ok) => { if (ok) setDone((d) => [...d, i.id]) })
  return (
    <Card labelledBy="mem7-carry-h">
      <h2 id="mem7-carry-h" className="card__title">{th('memory7.carryTitle')}</h2>
      <p>{t('memory7.carryIntro')}</p>
      <ul className="plain-list">
        {items.map((i) => (
          <li key={i.id}>
            <label className="choice"><input type="checkbox" checked={false} onChange={() => void carry(i)} /><span>{t('memory7.carryOne', { text: i.text })}</span></label>
          </li>
        ))}
      </ul>
      <p role="status">{done.length > 0 ? t('memory7.carriedCount', { n: String(done.length) }) : ''}</p>
      <p className="muted"><span>{t('memory7.carryNote')}</span></p>
    </Card>
  )
}


/** Add something by hand: the kind and value come from the server's list, the scope is the guest's choice, and a sensitive kind starts with its switch off. */
function AddForm({ kinds, enabled, sailingId, onAdd }: { kinds: readonly MemoryKind[]; enabled: boolean; sailingId: string; onAdd: (req: RememberRequest) => void }) {
  const [kind, setKind] = useState('')
  const [value, setValue] = useState('')
  const [scope, setScope] = useState<MemoryScope>('future')
  const current = kinds.find((k) => k.kind === kind)
  if (!enabled || kinds.length === 0) return null
  const req = toldRequest(kinds, kind, value, scope, sailingId)
  return (
    <Card labelledBy="mem7-add-h">
      <h2 id="mem7-add-h" className="card__title">{th('memory7.add.title')}</h2>
      <div className="field">
        <label htmlFor="mem7-kind">{t('memory7.add.kind')}</label>
        <select id="mem7-kind" className="field__input" value={kind} onChange={(e) => { setKind(e.target.value); setValue('') }}>
          <option value="">{t('memory7.add.choose')}</option>
          {kinds.map((k) => <option key={k.kind} value={k.kind}>{t(`memory7.kind.${k.kind}` as StringKey)}</option>)}
        </select>
      </div>
      {current && (
        <div className="field">
          <label htmlFor="mem7-value">{t('memory7.add.value')}</label>
          <select id="mem7-value" className="field__input" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">{t('memory7.add.choose')}</option>
            {current.values.map((v) => <option key={v} value={v}>{t(`memory7.value.${current.kind}.${v}` as StringKey)}</option>)}
          </select>
        </div>
      )}
      <fieldset>
        <legend>{t('memory7.add.scope')}</legend>
        {(['future', 'trip'] as const).map((s) => (
          <label key={s} className="choice"><input type="radio" name="mem7-scope" checked={scope === s} onChange={() => setScope(s)} /><span>{scopeLabel(s)}</span></label>
        ))}
      </fieldset>
      {current?.sensitive && <p className="muted">{t('memory7.add.sensitive')}</p>}
      <Button disabled={!req} onClick={() => { if (req) { onAdd(req); setKind(''); setValue('') } }}>{t('memory7.add.go')}</Button>
      {!req && <p className="muted">{t('memory7.add.why')}</p>}
    </Card>
  )
}
