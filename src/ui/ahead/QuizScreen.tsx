import { useMemory } from '../../hooks/useMemory'
import { useSettings } from '../../hooks/useSettings'
import { stanleyLevelFor } from '../../settings/settings'
import type { AskValue } from '../../ai/stanleyAsk'
import { StanleyAsk, type AskItem } from '../ai/StanleyAsk'
import { MoodTiles } from '../delights/PrepareDelights'
import { useState } from 'react'
import { Link } from 'react-router'
import { DEFAULT_QUIZ, QUIZ_BUDGETS, QUIZ_MOBILITY, QUIZ_MUSTS, QUIZ_VIBES, QUIZ_WITH, quizFare, recommend, type QuizAnswers, type QuizMust } from '../../domain/ahead'
import { formatMoney } from '../../domain/money'
import { categoryById } from '../../domain/ship'
import { useSailing } from '../../hooks/useDemo'
import { NIGHTS_BANDS, browseSailings, matchSailings, monthLabel, monthsOf, rangeOf, type NightsBand, type SailingWish } from '../../domain/catalogueBrowse'
import { catalogueRegions } from '../../domain/shipCatalogue'
import { useCatalogue } from '../../hooks/useCatalogue'
import { regionName, shipName } from '../discover/catalogueNames'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Back } from './common'

function Choice<T extends string>({ name, legend, values, value, onChange, label }: { name: string; legend: string; values: readonly T[]; value: T; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {values.map((v) => (
        <label key={v} className="choice">
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
          {label(v)}
        </label>
      ))}
    </fieldset>
  )
}

/** A short "Find my cruise" quiz that ends in a ranked shortlist of room types and a package, with the reasons (DIS-06). It also picks sailings: the region, month and length the guest names narrow the catalogue to the best few. */
export function QuizScreen() {
  const sailing = useSailing()
  useCatalogue()
  const [a, setA] = useState<QuizAnswers>(DEFAULT_QUIZ)
  const [wish, setWish] = useState<SailingWish>({})
  const sailings = browseSailings()
  const regions = catalogueRegions().filter((r) => sailings.some((x) => x.region === r.id))
  const months = monthsOf(sailings)
  const [shown, setShown] = useState(false)
  // Stanley asks one question at a time unless the guest keeps him quiet or picks the plain form; the answers are the same either way.
  const [settings] = useSettings()
  const level = stanleyLevelFor(settings)
  const [mode, setMode] = useState<'ask' | 'done' | 'form'>(level === 'helpful' || level === 'chatty' ? 'ask' : 'form')
  const setW = (key: keyof SailingWish, value: string) => { setShown(false); setWish((w) => ({ ...w, [key]: value || undefined }) as SailingWish) }
  const matches = shown ? matchSailings(sailings, wish) : []
  const { state } = useMemory()
  const result = shown ? recommend(a, state.prepare.moods) : null
  const toggle = (m: QuizMust) => { setShown(false); setA({ ...a, musts: a.musts.includes(m) ? a.musts.filter((x) => x !== m) : [...a.musts, m] }) }
  const set = <K extends keyof QuizAnswers>(key: K) => (value: QuizAnswers[K]) => { setShown(false); setA({ ...a, [key]: value }) }
  const none = { value: '', label: t('stanley.ask.quiz.any') }
  const opts = <T extends string>(values: readonly T[], key: string) => values.map((v) => ({ value: v, label: t(`quiz.${key}.${v}` as StringKey) }))
  const items: AskItem[] = [
    { id: 'vibe', prompt: t('quiz.vibe'), why: t('stanley.ask.quiz.why.vibe'), options: opts(QUIZ_VIBES, 'vibe') },
    { id: 'budget', prompt: t('quiz.budget'), why: t('stanley.ask.quiz.why.budget'), options: opts(QUIZ_BUDGETS, 'budget') },
    { id: 'with', prompt: t('quiz.with'), why: t('stanley.ask.quiz.why.with'), options: opts(QUIZ_WITH, 'with') },
    { id: 'mobility', prompt: t('quiz.mobility'), why: t('stanley.ask.quiz.why.mobility'), options: opts(QUIZ_MOBILITY, 'mobility') },
    { id: 'musts', prompt: t('quiz.musts'), why: t('stanley.ask.quiz.why.musts'), multi: true, options: opts(QUIZ_MUSTS, 'must') },
    ...(regions.length > 1 ? [{ id: 'region', prompt: t('cat.region'), why: t('stanley.ask.quiz.why.region'), options: [none, ...regions.map((r) => ({ value: r.id, label: r.name }))] }] : []),
    ...(months.length > 1 ? [{ id: 'month', prompt: t('cat.month'), why: t('stanley.ask.quiz.why.month'), options: [none, ...months.map((m) => ({ value: m, label: monthLabel(m) }))] }] : []),
    { id: 'nights', prompt: t('cat.length'), why: t('stanley.ask.quiz.why.nights'), options: [none, ...NIGHTS_BANDS.map((b: NightsBand) => ({ value: b, label: t(`cat.nights.${b}` as StringKey) }))] },
  ]
  const values: Record<string, AskValue | undefined> = { ...a, region: wish.region ?? '', month: wish.month ?? '', nights: wish.nights ?? '' }
  const answer = (id: string, value: AskValue) => {
    if (id === 'region' || id === 'month' || id === 'nights') setW(id, value as string)
    else if (id === 'musts') { setShown(false); setA((x) => ({ ...x, musts: value as QuizMust[] })) }
    else { setShown(false); setA((x) => ({ ...x, [id]: value }) as QuizAnswers) }
  }
  return (
    <div className="page">
      <p>{t('quiz.intro')}</p>
      {mode === 'ask' && <StanleyAsk title={t('stanley.ask.quiz.title')} items={items} values={values} onChange={answer} onDone={() => { setShown(true); setMode('done') }} onShowAll={() => setMode('form')} />}
      {mode === 'done' && (
        <div className="button-row">
          <Button variant="secondary" onClick={() => setMode('ask')}>{t('stanley.ask.change')}</Button>
          <Button variant="tertiary" onClick={() => setMode('form')}>{t('stanley.ask.showAll')}</Button>
        </div>
      )}
      {mode === 'form' && <form onSubmit={(e) => { e.preventDefault(); setShown(true) }}>
        <Choice name="vibe" legend={t('quiz.vibe')} values={QUIZ_VIBES} value={a.vibe} onChange={set('vibe')} label={(v) => t(`quiz.vibe.${v}` as StringKey)} />
        <Choice name="budget" legend={t('quiz.budget')} values={QUIZ_BUDGETS} value={a.budget} onChange={set('budget')} label={(v) => t(`quiz.budget.${v}` as StringKey)} />
        <Choice name="with" legend={t('quiz.with')} values={QUIZ_WITH} value={a.with} onChange={set('with')} label={(v) => t(`quiz.with.${v}` as StringKey)} />
        <Choice name="mobility" legend={t('quiz.mobility')} values={QUIZ_MOBILITY} value={a.mobility} onChange={set('mobility')} label={(v) => t(`quiz.mobility.${v}` as StringKey)} />
        <fieldset>
          <legend>{t('quiz.musts')}</legend>
          {QUIZ_MUSTS.map((m) => (
            <label key={m} className="choice">
              <input type="checkbox" checked={a.musts.includes(m)} onChange={() => toggle(m)} />
              {t(`quiz.must.${m}` as StringKey)}
            </label>
          ))}
        </fieldset>
        {(regions.length > 1 || months.length > 1) && (
          <fieldset>
            <legend>{t('cat.quiz.where')}</legend>
            {regions.length > 1 && (
              <div className="field">
                <label htmlFor="wish-region">{t('cat.region')}</label>
                <select id="wish-region" value={wish.region ?? ''} onChange={(e) => setW('region', e.target.value)}>
                  <option value="">{t('cat.anyRegion')}</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
            {months.length > 1 && (
              <div className="field">
                <label htmlFor="wish-month">{t('cat.month')}</label>
                <select id="wish-month" value={wish.month ?? ''} onChange={(e) => setW('month', e.target.value)}>
                  <option value="">{t('cat.anyMonth')}</option>
                  {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="wish-nights">{t('cat.length')}</label>
              <select id="wish-nights" value={wish.nights ?? ''} onChange={(e) => setW('nights', e.target.value)}>
                <option value="">{t('cat.anyLength')}</option>
                {NIGHTS_BANDS.map((b: NightsBand) => <option key={b} value={b}>{t(`cat.nights.${b}` as StringKey)}</option>)}
              </select>
            </div>
          </fieldset>
        )}
        <Button type="submit">{t('quiz.show')}</Button>
      </form>}
      {result && (
        <section aria-labelledby="quiz-result-h" aria-live="polite">
          <h2 id="quiz-result-h">{th('quiz.result')}</h2>
          {result.picks.length === 0 ? <p>{t('quiz.none')}</p> : (
            <ol className="card-grid">
              {result.picks.map((p, i) => {
                const c = categoryById(p.category)!
                const fare = quizFare(sailing.id, p.category)
                return (
                  <li key={p.category}>
                    <Card hero={i === 0}>
                      <h3 className="card__title">{i + 1}. {c.name}</h3>
                      <p>{c.summary}</p>
                      {fare !== null && <p className="muted">{t('quiz.from', { price: formatMoney(fare) })}</p>}
                      <ul className="plain-bullets">{p.reasons.map((r) => <li key={r}>{t(`quiz.why.${r.replace('.', '_')}` as StringKey)}</li>)}</ul>
                    </Card>
                  </li>
                )
              })}
            </ol>
          )}
          {matches.length > 0 && (
            <section aria-labelledby="quiz-sailings-h">
              <h3 id="quiz-sailings-h">{th('cat.quiz.sailings')}</h3>
              <ol className="card-grid">
                {matches.map((m) => (
                  <li key={m.sailing.id}>
                    <Card>
                      <h4 className="card__title"><Link to={`/home/sailings/${m.sailing.id}`}>{m.sailing.title}</Link></h4>
                      <p>{rangeOf(m.sailing)} · {shipName(m.sailing.ship)}{m.sailing.region ? ` · ${regionName(m.sailing.region)}` : ''}</p>
                      <ul className="plain-bullets">{m.reasons.map((r) => <li key={r}>{t(`cat.quiz.why.${r}` as StringKey)}</li>)}</ul>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <p><strong>{t('quiz.package')}</strong> {t(`quiz.pkg.${result.package}` as StringKey)} {t(`quiz.pkgWhy.${result.packageWhy}` as StringKey)}</p>
          {result.notes.length > 0 && <ul className="plain-bullets">{result.notes.map((n) => <li key={n}>{t(`quiz.note.${n}` as StringKey)}</li>)}</ul>}
          <p><Link to="/book">{t('quiz.book')}</Link> · <Link to="/home/advisors">{t('quiz.advisor')}</Link></p>
        </section>
      )}
      <MoodTiles />
      <Back to="/" label={t('route.home')} />
    </div>
  )
}
