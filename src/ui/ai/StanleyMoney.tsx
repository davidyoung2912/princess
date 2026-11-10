import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import type { PackagesView } from '../../api/types'
import { formatMoney } from '../../domain/money'
import { ADD_ONS } from '../../domain/packages'
import { normalizeCase, type StanleyCase } from '../../ai/stanleyHandoff'
import {
  MONEY_ITEMS, budgetFromText, canQuestion, disputeRequest, entitlementRequest, normalizeBudget, normalizeEntitlement, normalizeFolio, normalizeLoyalty, normalizePace, normalizePackageValue, normalizeScenario,
  packageUseRequest, priceTextIsValid, scenarioRequest, verdictTone, USE_LIMITS, NOTE_MAX,
  type EntitlementResult, type FolioExplain, type FolioLineView, type LoyaltyCoach, type MoneyItem, type Pace, type PackageValue, type Scenario, type ScenarioPick,
} from '../../ai/stanleyMoney'
import { useMemory } from '../../hooks/useMemory'
import { useSailing } from '../../hooks/useDemo'
import { t, th, type StringKey } from '../../i18n'
import { stanleyMoney } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'

const asOfText = (at: number): string => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(at)
const PACKAGE_NAMES = { plus: 'Princess Plus', premier: 'Princess Premier' } as const

/** Is this included for me? (phase 12). The answer is worked out on the server from each traveller's own entitlements and what is left of them; nothing is bought or changed. */
export function StanleyEntitlementCard({ people }: { people: { id: string; name: string }[] }) {
  const id = useId()
  const sailing = useSailing()
  const [item, setItem] = useState<MoneyItem>('drink')
  const [who, setWho] = useState('')
  const [price, setPrice] = useState('')
  const [alcohol, setAlcohol] = useState(true)
  const [result, setResult] = useState<EntitlementResult | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const valid = priceTextIsValid(price)
  const ask = async () => {
    const body = entitlementRequest(item, who === 'all' ? '' : who, who === 'all', price, alcohol, sailing.id)
    if (!body) return
    setBusy(true); setFailed(false)
    try { const r = normalizeEntitlement(await stanleyMoney.entitlement(body)); setResult(r); setFailed(r === null) } catch { setFailed(true) } finally { setBusy(false) }
  }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('mo12.ent.title')}</h2>
      <p>{t('mo12.ent.intro')}</p>
      <div className="field">
        <label htmlFor={`${id}-item`}>{t('mo12.ent.item')}</label>
        <select id={`${id}-item`} className="field__input" value={item} onChange={(e) => { setItem(e.target.value as MoneyItem); setResult(null) }}>
          {MONEY_ITEMS.map((x) => <option key={x} value={x}>{t(`mo12.item.${x}` as StringKey)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-who`}>{t('mo12.ent.who')}</label>
        <select id={`${id}-who`} className="field__input" value={who} onChange={(e) => { setWho(e.target.value); setResult(null) }}>
          <option value="">{t('mo12.ent.me')}</option>
          {people.length > 1 && <option value="all">{t('mo12.ent.everyone')}</option>}
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {item === 'drink' && (
        <>
          <Field label={t('mo12.ent.price')} hint={t('mo12.ent.priceHint')} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={valid ? undefined : t('mo12.ent.priceBad')} />
          <label className="choice"><input type="checkbox" checked={alcohol} onChange={(e) => setAlcohol(e.target.checked)} /><span>{t('mo12.ent.alcohol')}</span></label>
        </>
      )}
      <Button variant="secondary" onClick={() => void ask()} disabled={busy || !valid}>{t('mo12.ent.ask')}</Button>
      <div role="status">
        {failed && <p>{t('mo12.failed')}</p>}
        {result && (
          <>
            <ul className="plain-list">
              {result.answers.map((a) => (
                <li key={`${a.item}-${a.traveller}`}>
                  <p><span className={verdictTone(a.verdict) === 'good' ? 'tag tag--good' : verdictTone(a.verdict) === 'warn' ? 'tag tag--alert' : 'tag'}>{t(`mo12.verdict.${a.verdict}` as StringKey)}</span> <strong>{a.traveller}</strong></p>
                  {a.lines.map((l) => <p key={l}>{l}</p>)}
                  {a.youPayCents !== null && <p><strong>{t('mo12.ent.youPay', { amount: formatMoney(a.youPayCents) })}</strong></p>}
                  <p className="muted">{t('mo12.basis', { basis: a.basis })}</p>
                </li>
              ))}
            </ul>
            <p className="muted">{result.note}</p>
          </>
        )}
      </div>
    </Card>
  )
}

/** Package value from the family's own chosen use. Nothing is filled in for them: they say how much they expect to use, and the server compares each add-on with paying as you go. */
export function StanleyPackageValue() {
  const id = useId()
  const sailing = useSailing()
  const [drinks, setDrinks] = useState('')
  const [wifi, setWifi] = useState('')
  const [dinners, setDinners] = useState('')
  const [value, setValue] = useState<PackageValue | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const body = packageUseRequest(drinks, wifi, dinners, sailing.id)
  const compare = async () => {
    if (!body) return
    setBusy(true); setFailed(false)
    try { const v = normalizePackageValue(await stanleyMoney.packageValue(body)); setValue(v); setFailed(v === null) } catch { setFailed(true) } finally { setBusy(false) }
  }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('mo12.val.title')}</h2>
      <p>{t('mo12.val.intro')}</p>
      <Field label={t('mo12.val.drinks')} hint={t('mo12.val.range', { max: USE_LIMITS.drinksPerDay })} inputMode="numeric" value={drinks} onChange={(e) => setDrinks(e.target.value)} />
      <Field label={t('mo12.val.wifi')} hint={t('mo12.val.range', { max: USE_LIMITS.wifiDays })} inputMode="numeric" value={wifi} onChange={(e) => setWifi(e.target.value)} />
      <Field label={t('mo12.val.dinners')} hint={t('mo12.val.range', { max: USE_LIMITS.specialtyDinners })} inputMode="numeric" value={dinners} onChange={(e) => setDinners(e.target.value)} />
      <Button variant="secondary" onClick={() => void compare()} disabled={busy || !body}>{t('mo12.val.compare')}</Button>
      {!body && <p className="muted">{t('mo12.val.need')}</p>}
      <div role="status">
        {failed && <p>{t('mo12.failed')}</p>}
        {value && (
          <>
            {value.rows.length === 0 && <p>{value.lines[0]}</p>}
            <ul className="plain-list">
              {value.rows.map((r) => (
                <li key={r.id}>
                  <p><strong>{r.name}</strong> · {t('mo12.val.people', { count: r.people })}</p>
                  <p>{t('mo12.val.package', { amount: formatMoney(r.packageCents) })} · {t('mo12.val.go', { amount: formatMoney(r.payAsYouGoCents) })}</p>
                  <p className={r.verdict === 'worth' ? 'tag tag--good' : 'tag'}>{t(`mo12.val.verdict.${r.verdict}` as StringKey, { amount: formatMoney(Math.abs(r.differenceCents)) })}</p>
                  <p className="muted">{r.basis}</p>
                </li>
              ))}
            </ul>
            <p className="muted">{t('mo12.illustrative')}</p>
          </>
        )}
      </div>
    </Card>
  )
}

/** "If we book this, what will the family total be?" Adds the picks to what is already planned. It books nothing and says what it leaves out. */
export function StanleyScenarioCard({ view }: { view: PackagesView }) {
  const id = useId()
  const sailing = useSailing()
  const [picks, setPicks] = useState<ScenarioPick[]>([])
  const [result, setResult] = useState<Scenario | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const has = (kind: ScenarioPick['kind'], pick: string) => picks.some((p) => p.kind === kind && p.id === pick)
  const toggle = (kind: ScenarioPick['kind'], pick: string) => { setResult(null); setPicks(has(kind, pick) ? picks.filter((p) => !(p.kind === kind && p.id === pick)) : [...picks, { kind, id: pick }]) }
  const upgrades = [...new Set(view.upgrades.flatMap((u) => u.options.map((o) => o.to)))]
  const body = scenarioRequest(picks, sailing.id)
  const run = async () => {
    if (!body) return
    setBusy(true); setFailed(false)
    try { const s = normalizeScenario(await stanleyMoney.scenario(body)); setResult(s); setFailed(s === null) } catch { setFailed(true) } finally { setBusy(false) }
  }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('mo12.sc.title')}</h2>
      <p>{t('mo12.sc.intro')}</p>
      <fieldset className="field">
        <legend>{t('mo12.sc.pick')}</legend>
        {view.addOns.filter((a) => a.eligible.length > 0).map((a) => (
          <label key={a.id} className="choice"><input type="checkbox" checked={has('addOn', a.id)} onChange={() => toggle('addOn', a.id)} /><span>{ADD_ONS[a.id].name}</span></label>
        ))}
        {upgrades.map((to) => (
          <label key={to} className="choice"><input type="checkbox" checked={has('upgrade', to)} onChange={() => toggle('upgrade', to)} /><span>{t('mo12.sc.upgrade', { name: PACKAGE_NAMES[to] })}</span></label>
        ))}
      </fieldset>
      <Button variant="secondary" onClick={() => void run()} disabled={busy || !body}>{t('mo12.sc.run')}</Button>
      <div role="status">
        {failed && <p>{t('mo12.failed')}</p>}
        {result && (
          <>
            <p><strong>{t('mo12.sc.total', { total: formatMoney(result.newTotalCents) })}</strong> <span className="muted">{t('mo12.sc.was', { was: formatMoney(result.newTotalCents - result.addedCents) })}</span></p>
            <ul>{result.adds.map((a) => <li key={`${a.kind}-${a.id}`}>{a.label}: {formatMoney(a.totalCents)} <span className="muted">({a.basis})</span></li>)}</ul>
            {result.leftCents !== null && result.budgetCents !== null && <p className={result.state === 'over' ? 'tag tag--alert' : 'tag'}>{result.leftCents >= 0 ? t('mo12.sc.left', { left: formatMoney(result.leftCents), budget: formatMoney(result.budgetCents) }) : t('mo12.sc.over', { over: formatMoney(-result.leftCents), budget: formatMoney(result.budgetCents) })}</p>}
            {result.budgetCents === null && <p className="muted">{t('mo12.noBudget')}</p>}
            <p className="muted">{t('mo12.sc.notCounted', { list: result.notCounted.join('; ') })}</p>
            <p className="muted">{t('mo12.illustrative')}</p>
          </>
        )}
      </div>
    </Card>
  )
}

/** The budget Stanley may watch and the spending pace against it. Only the guest sets or clears the budget; nothing is blocked by it. */
export function StanleyPaceCard() {
  const id = useId()
  const sailing = useSailing()
  const { state: memory } = useMemory()
  const [budget, setBudget] = useState<number | null | undefined>(undefined)
  const [typed, setTyped] = useState('')
  const [pace, setPace] = useState<Pace | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    stanleyMoney.budget().then((raw) => { if (live) setBudget(normalizeBudget(raw)) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (budget === undefined) return
    let live = true
    stanleyMoney.pace(sailing.id).then((raw) => { if (live) setPace(normalizePace(raw)) }, () => { if (live) setPace(null) })
    return () => { live = false }
  }, [budget, sailing.id])
  const save = async (cents: number | null) => {
    setFailed(false)
    try { setBudget(normalizeBudget(await stanleyMoney.setBudget(cents))); setTyped('') } catch { setFailed(true) }
  }
  const typedCents = budgetFromText(typed)
  if (budget === undefined && !failed) return null
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('mo12.pace.title')}</h2>
      <p>{t('mo12.pace.intro')}</p>
      {budget ? (
        <p>{t('mo12.pace.watching', { budget: formatMoney(budget) })} <Button variant="tertiary" onClick={() => void save(null)}>{t('mo12.pace.stop')}</Button></p>
      ) : (
        <>
          <Field label={t('mo12.pace.field')} hint={t('mo12.pace.hint')} inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} error={typed.trim() !== '' && typedCents === null ? t('mo12.pace.bad') : undefined} />
          <Button variant="secondary" onClick={() => typedCents !== null && void save(typedCents)} disabled={typedCents === null}>{t('mo12.pace.watch')}</Button>
          {memory.budget !== null && memory.budget > 0 && <Button variant="tertiary" onClick={() => void save(memory.budget)}>{t('mo12.pace.useMine', { budget: formatMoney(memory.budget) })}</Button>}
        </>
      )}
      <div role="status">
        {failed && <p>{t('mo12.failed')}</p>}
        {pace && pace.state !== 'noBudget' && (
          <>
            {pace.lines.map((l) => <p key={l}>{l}</p>)}
            {(pace.state === 'near' || pace.state === 'over') && <p className="muted">{t('mo12.pace.gentle')}</p>}
          </>
        )}
        {pace && pace.state === 'noBudget' && pace.projectedTotalCents !== null && !budget && <p className="muted">{t('mo12.noBudget')}</p>}
      </div>
    </Card>
  )
}

function QuestionLine({ line, sailingId, onOpened }: { line: FolioLineView; sailingId: string; onOpened: (c: StanleyCase) => void }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<'' | 'busy' | 'failed' | 'already' | 'tooMany'>('')
  const send = async () => {
    const body = disputeRequest(line, { consent, note }, sailingId)
    if (!body) return
    setState('busy')
    try {
      const c = normalizeCase(await stanleyMoney.dispute(body))
      if (c) { onOpened(c); setOpen(false); setState('') } else setState('failed')
    } catch (e) {
      const m = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
      setState(m === 'alreadyQuestioned' ? 'already' : m === 'tooManyCases' ? 'tooMany' : 'failed')
    }
  }
  if (!open) return <Button variant="tertiary" onClick={() => setOpen(true)}>{t('mo12.folio.question')}<span className="visually-hidden"> {line.description}</span></Button>
  return (
    <div role="group" aria-labelledby={`${id}-l`}>
      <p id={`${id}-l`}>{t('mo12.folio.questionHelp', { what: line.description, amount: formatMoney(line.cents) })}</p>
      <div className="field">
        <label htmlFor={`${id}-n`}>{t('mo12.folio.note')}</label>
        <textarea id={`${id}-n`} className="field__input" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <label className="choice"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>{t('mo12.folio.consent')}</span></label>
      <Button variant="secondary" onClick={() => void send()} disabled={!consent || state === 'busy'}>{t('mo12.folio.send')}</Button>
      <Button variant="tertiary" onClick={() => setOpen(false)}>{t('mo12.folio.cancel')}</Button>
      <p role="status" className="muted">{state === 'failed' ? t('mo12.failed') : state === 'already' ? t('mo12.folio.already') : state === 'tooMany' ? t('mo12.folio.tooMany') : ''}</p>
    </div>
  )
}

/** The onboard account explained with posted, pending, questioned and estimated amounts kept apart (phase 12). Questioning a charge opens a tracked billing case; it never changes the charge or marks anything settled. */
export function StanleyFolioCard() {
  const id = useId()
  const sailing = useSailing()
  const [folio, setFolio] = useState<FolioExplain | null>(null)
  const [failed, setFailed] = useState(false)
  const [opened, setOpened] = useState<StanleyCase | null>(null)
  const load = () => stanleyMoney.folio(sailing.id).then((raw) => { const f = normalizeFolio(raw); setFolio(f); setFailed(f === null) }, () => setFailed(true))
  useEffect(() => {
    let live = true
    stanleyMoney.folio(sailing.id).then((raw) => { if (live) { const f = normalizeFolio(raw); setFolio(f); setFailed(f === null) } }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [sailing.id])
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th(folio?.final ? 'mo12.folio.finalTitle' : 'mo12.folio.title')}</h2>
      <div role="status">
        {failed && <p>{t('mo12.failed')}</p>}
        {opened && <p className="tag">{t('mo12.folio.opened', { reference: opened.reference, owner: opened.owner })}</p>}
      </div>
      {folio && (
        <>
          {folio.lines.map((l) => <p key={l}>{l}</p>)}
          {folio.groups.map((g) => (
            <details key={g.state} open={g.state === 'disputed'}>
              <summary>{t('mo12.folio.group', { heading: g.heading, count: g.count, amount: formatMoney(g.cents) })}</summary>
              <p className="muted">{g.meaning}</p>
              {g.lines.length === 0 ? <p>{t('mo12.folio.none')}</p> : (
                <ul className="plain-list">
                  {g.lines.map((l) => (
                    <li key={l.id}>
                      <p><strong>{l.description}</strong> · {l.guest} · {t('mo12.folio.day', { day: l.day })} · {l.cents < 0 ? t('mo12.folio.credit', { amount: formatMoney(-l.cents) }) : formatMoney(l.cents)}</p>
                      <p className="muted">{l.why}</p>
                      {l.caseReference && <p className="tag">{t('mo12.folio.caseRef', { reference: l.caseReference })}</p>}
                      {canQuestion(l) && <QuestionLine line={l} sailingId={sailing.id} onOpened={(c) => { setOpened(c); void load() }} />}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          ))}
          {folio.estimate && <p className="muted">{folio.estimate.text}</p>}
          <p className="muted">{t('mo12.folio.asOf', { time: asOfText(folio.asOf) })} <Link to="/me/bill">{t('route.bill')}</Link></p>
        </>
      )}
    </Card>
  )
}

/** Captain's Circle progress, credits and when they expire, from the loyalty record. Never a promise of a level. */
export function StanleyLoyaltyCoach() {
  const id = useId()
  const [coach, setCoach] = useState<LoyaltyCoach | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    stanleyMoney.loyalty().then((raw) => { if (live) { const c = normalizeLoyalty(raw); setCoach(c); setFailed(c === null) } }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  if (!coach && !failed) return null
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('mo12.loy.title')}</h2>
      <div role="status">{failed && <p>{t('mo12.failed')}</p>}</div>
      {coach && (
        <>
          {coach.lines.map((l) => <p key={l}>{l}</p>)}
          {coach.credits.some((c) => c.expiresSoon) && <p className="tag tag--alert">{t('mo12.loy.soon')}</p>}
        </>
      )}
    </Card>
  )
}

/** The money panel on the Packages screen: is it included, package value and the family total. */
export function StanleyMoneyPanel({ view }: { view: PackagesView }) {
  return (
    <section aria-labelledby="mo12-h">
      <h2 id="mo12-h">{th('mo12.region')}</h2>
      <StanleyEntitlementCard people={view.people.map((p) => ({ id: p.id, name: p.name }))} />
      <StanleyPackageValue />
      <StanleyScenarioCard view={view} />
    </section>
  )
}
