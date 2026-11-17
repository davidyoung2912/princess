import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeStanding, ruleBody, ruleReady, type Standing, type StandingItem } from '../../ai/stanleyStanding'
import { t, th } from '../../i18n'
import { stanleyStanding } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { FieldLabel } from '../Field'

function Items({ items, heading, id }: { items: StandingItem[]; heading: string; id: string }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>{heading}</h3>
      <ul className="stack">
        {items.map((x) => (
          <li key={x.id}>
            <p><strong>{x.title}</strong></p>
            <p>{x.detail}</p>
            {x.route && <Link className="button button--secondary" to={x.route}>{t('stanleyRules.open')}</Link>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Standing rules, the availability watch and practice mode (phase P9a). A rule only notices or lines something up for the guest to open: it never books, holds a table or place, or sends anything. A rule in practice lists
 * what it would have offered and offers nothing until the guest graduates it with one tap. The server reads the rules when this card loads.
 */
export function StanleyStandingCard() {
  const [result, setResult] = useState<Standing | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const [templateId, setTemplateId] = useState('')
  const [target, setTarget] = useState('')
  const [day, setDay] = useState('')
  const [time, setTime] = useState('')
  const [practice, setPractice] = useState(true)
  const [problem, setProblem] = useState('')
  const live = useRef(true)
  const ids = useId()

  const take = useCallback((raw: unknown) => {
    if (!live.current) return
    const next = normalizeStanding(raw)
    setResult(next)
    setFailed(next === null)
    setBusy(false)
  }, [])
  const fail = useCallback((e: unknown) => {
    if (!live.current) return
    setBusy(false)
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : ''
    const known = { full: t('stanleyRules.problem.full'), duplicate: t('stanleyRules.problem.duplicate'), time: t('stanleyRules.problem.time'), day: t('stanleyRules.problem.day'), target: t('stanleyRules.problem.target') } as Record<string, string>
    setProblem(known[code] ?? t('stanleyRules.error'))
  }, [])
  const run = useCallback((go: () => Promise<unknown>) => {
    setBusy(true)
    setProblem('')
    return go().then(take, fail)
  }, [take, fail])

  useEffect(() => {
    live.current = true
    void stanleyStanding.get().then(take, fail)
    return () => { live.current = false }
  }, [take, fail])

  const chosen = result?.templates.find((x) => x.id === templateId)
  const form = { target, day, time }
  const add = () => {
    if (!chosen) return
    void run(() => stanleyStanding.add(ruleBody(chosen.param, chosen.id, { ...form, practice }))).then(() => { setTemplateId(''); setTarget(''); setDay(''); setTime('') })
  }

  return (
    <Card labelledBy="rules-h">
      <h2 id="rules-h" className="card__title">{th('stanleyRules.title')}</h2>
      <p>{t('stanleyRules.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyRules.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyRules.error')}</p>}
        {problem && <p role="alert" className="field__error">{problem}</p>}
        {result && !result.enabled && <p>{t('stanleyRules.off')}</p>}
      </div>
      {result?.enabled && (
        <>
          {result.rules.length === 0 && <p role="status">{t('stanleyRules.none')}</p>}
          {result.rules.length > 0 && (
            <ul className="stack" aria-label={t('stanleyRules.yours')}>
              {result.rules.map((r) => (
                <li key={r.id}>
                  <p>{r.wording}</p>
                  <p>{t(`stanleyRules.state.${r.state}`)}</p>
                  <div className="button-row">
                    {r.practice && <Button variant="secondary" disabled={busy} onClick={() => { void run(() => stanleyStanding.setPractice(r.id, false)) }}>{t('stanleyRules.graduate')}</Button>}
                    {!r.practice && <Button variant="secondary" disabled={busy} onClick={() => { void run(() => stanleyStanding.setPractice(r.id, true)) }}>{t('stanleyRules.tryFirst')}</Button>}
                    <Button variant="secondary" disabled={busy} onClick={() => { void run(() => stanleyStanding.remove(r.id)) }}>{t('stanleyRules.remove')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Items id={`${ids}-items`} heading={t('stanleyRules.items')} items={result.items} />
          {result.rolled > 0 && <p>{t('stanleyRules.rolled', { count: result.rolled })}</p>}
          <Items id={`${ids}-practice`} heading={t('stanleyRules.practice')} items={result.practice} />

          {result.rules.length < result.maxRules && (
            <section aria-labelledby={`${ids}-add`}>
              <h3 id={`${ids}-add`}>{th('stanleyRules.add')}</h3>
              <FieldLabel htmlFor={`${ids}-t`}>{t('stanleyRules.template')}</FieldLabel>
              <select id={`${ids}-t`} className="field__input" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setTarget(''); setDay(''); setTime('') }}>
                <option value="">{t('stanleyRules.choose')}</option>
                {result.templates.map((x) => <option key={x.id} value={x.id}>{x.wording}</option>)}
              </select>
              {chosen && (chosen.param === 'table' || chosen.param === 'tour') && (
                <>
                  <FieldLabel htmlFor={`${ids}-target`}>{t(chosen.param === 'table' ? 'stanleyRules.restaurant' : 'stanleyRules.tour')}</FieldLabel>
                  <select id={`${ids}-target`} className="field__input" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">{t('stanleyRules.choose')}</option>
                    {(chosen.param === 'table' ? result.tables : result.tours).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </>
              )}
              {chosen && (chosen.param === 'table' || chosen.param === 'day') && (
                <>
                  <FieldLabel htmlFor={`${ids}-day`}>{t(chosen.param === 'table' ? 'stanleyRules.night' : 'stanleyRules.formalDay')}</FieldLabel>
                  <input id={`${ids}-day`} className="field__input" type="number" inputMode="numeric" min={1} max={Math.max(1, result.nights)} value={day} onChange={(e) => setDay(e.target.value)} />
                </>
              )}
              {chosen && (chosen.param === 'table' || chosen.param === 'time') && (
                <>
                  <FieldLabel htmlFor={`${ids}-time`}>{t(chosen.param === 'table' ? 'stanleyRules.timeOptional' : 'stanleyRules.dinnerTime')}</FieldLabel>
                  <select id={`${ids}-time`} className="field__input" value={time} onChange={(e) => setTime(e.target.value)}>
                    <option value="">{t(chosen.param === 'table' ? 'stanleyRules.anyTime' : 'stanleyRules.choose')}</option>
                    {result.times.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </>
              )}
              {chosen && chosen.rung >= 3 && (
                <label>
                  <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} />
                  {' '}{t('stanleyRules.practiceFirst')}
                </label>
              )}
              <div className="button-row">
                <Button disabled={busy || !chosen || !ruleReady(chosen.param, form)} onClick={add}>{t('stanleyRules.make')}</Button>
              </div>
            </section>
          )}
          {result.notChecked.length > 0 && (
            <section aria-labelledby={`${ids}-not`}>
              <h3 id={`${ids}-not`}>{th('stanleyRules.notChecked')}</h3>
              <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
            </section>
          )}
        </>
      )}
    </Card>
  )
}
