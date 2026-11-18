import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LifeBuoy, MessageCircleQuestion } from 'lucide-react'
import { requestStanley } from '../../ai/stanleyOpen'
import { answerOf, LIBRARY, pageQaEntries, questionOf } from '../../ai/stanleyLibrary'
import { isLive } from '../../ai/stanleyLibrary/governance'
import { helpAnswers, type SearchAnswer } from '../../domain/answerDocs'
import { searchAnswers } from '../../domain/searchIndex'
import { SCREEN_BY_ID } from '../../routes/screens'
import { t, th } from '../../i18n'
import { Button } from '../Button'

/** Most answers shown at once. */
const MAX_ANSWERS = 12

/** Stanley's answers written for one screen, each pointing to that screen (a tab landing page has no screen of its own, so its answers point nowhere). */
function pageAnswers(): SearchAnswer[] {
  return pageQaEntries().map((e): SearchAnswer => {
    const screen = SCREEN_BY_ID.get(e.screens[0] ?? '')
    const caption = screen && !screen.path.includes(':') ? t('search.answers.onPage', { page: th(screen.titleKey) }) : ''
    return { id: `stanley:${e.id}`, source: 'stanley', question: questionOf(e), answer: answerOf(e), text: `${answerOf(e)} ${screen ? th(screen.titleKey) : ''}`, caption, link: screen && !screen.path.includes(':') ? { to: screen.path, label: t('search.answers.show') } : undefined }
  })
}

/** Written answers from the help centre and from Stanley's library, matching what the guest typed. Each opens in place; Stanley's can be taken further with one tap. */
export function SearchAnswers({ query }: { query: string }) {
  const [now] = useState(() => Date.now())
  const docs = useMemo<SearchAnswer[]>(() => [
    ...helpAnswers(),
    ...LIBRARY.filter((e) => isLive(e, now)).map((e): SearchAnswer => ({ id: `stanley:${e.id}`, source: 'stanley', question: questionOf(e), answer: answerOf(e), text: `${answerOf(e)} ${e.words ?? ''}`, link: e.link ? { to: e.link, label: t('search.answers.show') } : undefined })),
    ...pageAnswers(),
  ], [now])
  const found = useMemo(() => searchAnswers(query, docs, MAX_ANSWERS), [query, docs])
  if (found.length === 0) return null
  return (
    <section aria-labelledby="search-answers-h" className="search-answers">
      <h2 id="search-answers-h">{th('search.answers.title')}</h2>
      <ul className="faq-list">
        {found.map((a) => {
          const Icon = a.source === 'help' ? LifeBuoy : MessageCircleQuestion
          return (
            <li key={a.id}>
              <details>
                <summary><Icon className="search-answers__icon" size={20} aria-hidden="true" /><span>{a.question}{a.caption ? <small className="search-answers__page"> · {a.caption}</small> : null}</span></summary>
                <p>{a.answer}</p>
                {a.link && <p><Link to={a.link.to}>{a.link.label}</Link></p>}
                <div className="button-row"><Button variant="secondary" icon={MessageCircleQuestion} onClick={() => requestStanley(a.question)}>{t('search.answers.askMore')}</Button></div>
              </details>
            </li>
          )
        })}
      </ul>
      <p><Link to="/me/help">{t('search.answers.helpCentre')}</Link></p>
    </section>
  )
}
