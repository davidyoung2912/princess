import { useState } from 'react'
import { Link } from 'react-router'
import { DEFAULT_QUIZ, QUIZ_BUDGETS, QUIZ_MOBILITY, QUIZ_MUSTS, QUIZ_VIBES, QUIZ_WITH, quizFare, recommend, type QuizAnswers, type QuizMust } from '../../domain/ahead'
import { formatMoney } from '../../domain/pricing'
import { categoryById } from '../../domain/ship'
import { REFERENCE_SAILING } from '../../domain/sailings'
import { t, type StringKey } from '../../i18n'
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

/** A short "Find my cruise" quiz that ends in a ranked shortlist of room types and a package, with the reasons (DIS-06). The ship, route and nights are fixed, so the quiz picks the room and what to add. */
export function QuizScreen() {
  const [a, setA] = useState<QuizAnswers>(DEFAULT_QUIZ)
  const [shown, setShown] = useState(false)
  const result = shown ? recommend(a) : null
  const toggle = (m: QuizMust) => { setShown(false); setA({ ...a, musts: a.musts.includes(m) ? a.musts.filter((x) => x !== m) : [...a.musts, m] }) }
  const set = <K extends keyof QuizAnswers>(key: K) => (value: QuizAnswers[K]) => { setShown(false); setA({ ...a, [key]: value }) }
  return (
    <div className="page">
      <h1>{t('route.quiz')}</h1>
      <p>{t('quiz.intro')}</p>
      <form onSubmit={(e) => { e.preventDefault(); setShown(true) }}>
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
        <Button type="submit">{t('quiz.show')}</Button>
      </form>
      {result && (
        <section aria-labelledby="quiz-result-h" aria-live="polite">
          <h2 id="quiz-result-h">{t('quiz.result')}</h2>
          {result.picks.length === 0 ? <p>{t('quiz.none')}</p> : (
            <ol className="card-grid">
              {result.picks.map((p, i) => {
                const c = categoryById(p.category)!
                const fare = quizFare(REFERENCE_SAILING.id, p.category)
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
          <p><strong>{t('quiz.package')}</strong> {t(`quiz.pkg.${result.package}` as StringKey)} {t(`quiz.pkgWhy.${result.packageWhy}` as StringKey)}</p>
          {result.notes.length > 0 && <ul className="plain-bullets">{result.notes.map((n) => <li key={n}>{t(`quiz.note.${n}` as StringKey)}</li>)}</ul>}
          <p><Link to="/book">{t('quiz.book')}</Link> · <Link to="/home/advisors">{t('quiz.advisor')}</Link></p>
        </section>
      )}
      <Back to="/" label={t('route.home')} />
    </div>
  )
}
