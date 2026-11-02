import { useState } from 'react'
import { Link } from 'react-router'
import { budgetSearch, decisionSummary, decisionText, FEARS, FIT_QUESTIONS, fitNotes, GLOSSARY, inviteText, NOT_FOR, SUITS, type FitKey } from '../../domain/dream'
import { FARES, fareOptions, type FareId } from '../../domain/fares'
import { parseMoney } from '../../domain/money'
import { formatMoney } from '../../domain/money'
import { SAILINGS, sailingById } from '../../domain/sailings'
import { CATEGORIES, categoryById, type CategoryId } from '../../domain/ship'
import { useSailing } from '../../hooks/useDemo'
import { useMemory } from '../../hooks/useMemory'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { qualityFeed } from '../../feeds/sailingQuality'
import { useFeed } from '../../hooks/useServedFeeds'
import { Field, TextArea } from '../Field'
import { GutCheckFlip, ReadAloud } from '../delights/DiscoverDelights'

async function send(text: string, title: string): Promise<'shared' | 'copied' | 'failed' | null> {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return 'shared' }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (e) {
    return (e as Error).name === 'AbortError' ? null : 'failed'
  }
}

/** Dream and decide (S0-01 to S0-05, S0-10): is this for me, the real fears, a budget-first search, how each sailing looks, what is decided, and an invitation. */
export function DecideScreen() {
  const demo = useSailing()
  const { state, me, update } = useMemory()
  const [budgetText, setBudgetText] = useState(state.budget === null ? '' : String(state.budget / 100))
  const [guests, setGuests] = useState(2)
  const [sailingId, setSailingId] = useState(demo.id)
  const [category, setCategory] = useState<CategoryId | ''>('')
  const [fare, setFare] = useState<FareId | ''>('')
  const [inviteNote, setInviteNote] = useState('')
  const [shared, setShared] = useState<string | null>(null)

  const sailing = sailingById(sailingId) ?? demo
  const budget = parseMoney(budgetText)
  const result = budget !== null && budget > 0 ? budgetSearch(sailing, budget, guests) : null
  const quality = useFeed(qualityFeed, sailing.id)
  const useFare: FareId | null = category && fare && fareOptions(category).includes(fare) ? fare : null
  const summary = decisionSummary({ sailing, category: category || null, fare: useFare, guests, fitsChecked: state.fit.length > 0, budget: budget && budget > 0 ? budget : null })
  const toggleFit = (k: FitKey) => update((s) => ({ ...s, fit: s.fit.includes(k) ? s.fit.filter((x) => x !== k) : [...s.fit, k] }))
  const invite = inviteText(sailing, me?.firstName ?? '', inviteNote)
  const say = async (text: string, title: string) => setShared(await send(text, title))

  return (
    <div className="page">
      <h1>{t('route.decide')}</h1>
      <p>{t('decide.intro')}</p>

      <Card labelledBy="dec-fit">
        <h2 id="dec-fit" className="card__title">{t('decide.fit')}</h2>
        <h3>{t('decide.suits')}</h3>
        <ul className="plain-bullets">{SUITS.map((x) => <li key={x}>{x}</li>)}</ul>
        <h3>{t('decide.notFor')}</h3>
        <ul className="plain-bullets">{NOT_FOR.map((x) => <li key={x}>{x}</li>)}</ul>
        <fieldset className="field">
          <legend>{t('decide.fitAsk')}</legend>
          {FIT_QUESTIONS.map((q) => (
            <label key={q.key} className="choice"><input type="checkbox" checked={state.fit.includes(q.key)} onChange={() => toggleFit(q.key)} /><span>{q.question}</span></label>
          ))}
        </fieldset>
        {fitNotes(state.fit).map((n) => <p key={n}>{n}</p>)}
      </Card>

      <Card labelledBy="dec-fears">
        <h2 id="dec-fears" className="card__title">{t('decide.fears')}</h2>
        {FEARS.map((f) => (
          <details key={f.id}>
            <summary>{f.question}</summary>
            <p>{f.answer}</p>
          </details>
        ))}
        <h3>{t('decide.glossary')}</h3>
        <dl>{GLOSSARY.map((g) => <div key={g.term}><dt><strong>{g.term}</strong></dt><dd>{g.meaning}</dd></div>)}</dl>
      </Card>

      <Card labelledBy="dec-budget">
        <h2 id="dec-budget" className="card__title">{t('decide.budget')}</h2>
        <p>{t('decide.budgetBody')}</p>
        <div className="field">
          <label htmlFor="dec-sailing">{t('cost.sailing')}</label>
          <select id="dec-sailing" value={sailing.id} onChange={(e) => setSailingId(e.target.value)}>
            {SAILINGS.map((s) => <option key={s.id} value={s.id}>{s.departure}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dec-guests">{t('cost.guests')}</label>
          <select id="dec-guests" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <Field label={t('decide.budgetAmount')} inputMode="decimal" value={budgetText} onChange={(e) => { setBudgetText(e.target.value); const c = parseMoney(e.target.value); update((s) => ({ ...s, budget: c && c > 0 ? c : null })) }} error={budgetText.trim() !== '' && budget === null ? t('decide.budgetBad') : undefined} />
        {result && (
          <>
            {result.fitting.length === 0 ? <p>{t('decide.budgetNone', { price: formatMoney(result.cheapest ?? 0) })}</p> : (
              <ul className="plain-list">
                {result.fitting.slice(0, 6).map((o) => (
                  <li key={`${o.category}-${o.fare}`}>
                    <strong>{categoryById(o.category)?.name}</strong> · {FARES[o.fare].name} · {formatMoney(o.total)}
                    <br /><span className="muted">{t('decide.budgetLeft', { left: formatMoney(o.left), perDay: formatMoney(o.perPersonPerDay) })}</span>
                  </li>
                ))}
              </ul>
            )}
            {result.nearMiss.length > 0 && result.fitting.length === 0 && (
              <>
                <h3>{t('decide.nearMiss')}</h3>
                <ul className="plain-list">{result.nearMiss.map((o) => <li key={`${o.category}-${o.fare}`}>{categoryById(o.category)?.name} · {FARES[o.fare].name} · {formatMoney(o.total)} ({t('decide.over', { amount: formatMoney(-o.left) })})</li>)}</ul>
              </>
            )}
            <p className="muted">{t('decide.budgetNote')}</p>
          </>
        )}
      </Card>

      <GutCheckFlip initial={sailing.id} />

      <Card labelledBy="dec-quality">
        <h2 id="dec-quality" className="card__title">{t('decide.quality')}</h2>
        <ul className="plain-list">
          {!quality && <li><FeedWaiting /></li>}
          {quality?.notes.map((n) => (
            <li key={n.key}>
              <strong>{t(`decide.q.${n.key}` as StringKey)}:</strong> {n.text}
              <br /><span className="muted">{n.why}</span>
            </li>
          ))}
        </ul>
        <p className="muted">{t('decide.qualitySim')}</p>
      </Card>

      <Card labelledBy="dec-summary">
        <h2 id="dec-summary" className="card__title">{t('decide.summary')}</h2>
        <div className="field">
          <label htmlFor="dec-room">{t('cost.room')}</label>
          <select id="dec-room" value={category} onChange={(e) => setCategory(e.target.value as CategoryId | '')}>
            <option value="">{t('decide.notYet')}</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dec-fare">{t('cabins.fare')}</label>
          <select id="dec-fare" value={useFare ?? ''} onChange={(e) => setFare(e.target.value as FareId | '')}>
            <option value="">{t('decide.notYet')}</option>
            {(category ? fareOptions(category) : []).map((f) => <option key={f} value={f}>{FARES[f].name}</option>)}
          </select>
        </div>
        {([['decided', summary.decided], ['left', summary.left], ['mightChange', summary.mightChange]] as const).map(([k, list]) => (
          <div key={k}>
            <h3>{t(`decide.s.${k}` as StringKey)}</h3>
            <ul className="plain-bullets">{list.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
        <div className="button-row">
          <Button variant="secondary" onClick={() => void say(decisionText(summary), t('decide.summary'))}>{t('decide.sendSummary')}</Button>
          <ReadAloud text={decisionText(summary)} />
        </div>
        <p><Link to="/home/cabins">{t('route.cabins')}</Link> · <Link to="/home/cruise/cost">{t('route.tripCost')}</Link></p>
      </Card>

      <Card labelledBy="dec-invite">
        <h2 id="dec-invite" className="card__title">{t('decide.invite')}</h2>
        <p>{t('decide.inviteBody')}</p>
        <TextArea label={t('decide.inviteNote')} value={inviteNote} maxLength={200} onChange={(e) => setInviteNote(e.target.value)} />
        <pre className="recap-text">{invite}</pre>
        <Button onClick={() => void say(invite, t('decide.invite'))}>{t('decide.inviteSend')}</Button>
        <p className="muted">{t('decide.inviteNoLink')}</p>
        {shared && <p role="status">{t(`recap.shared.${shared}` as StringKey)}</p>}
      </Card>
    </div>
  )
}
