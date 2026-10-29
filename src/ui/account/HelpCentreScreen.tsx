import { useState } from 'react'
import { Link } from 'react-router'
import { searchFaqs } from '../../domain/help'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { t } from '../../i18n'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { Field } from '../Field'

/** Help centre (SUP-01): searchable answers to the questions guests ask most, each with a way to do the thing. */
export function HelpCentreScreen() {
  const [query, setQuery] = useState('')
  const results = searchFaqs(query)
  return (
    <div className="page">
      <h1>{t('route.helpCentre')}</h1>
      <Field label={t('faq.search')} hint={t('faq.searchHint')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      <p role="status" className="muted">{query.trim() ? t('faq.count', { count: results.length }) : ''}</p>
      {results.length === 0 ? (
        <Card info>
          <p>{t('faq.none')}</p>
          <div className="button-row">
            <LinkButton to="/me/contact">{t('faq.contact')}</LinkButton>
            <a className="btn btn--secondary" href={`tel:${GUEST_SERVICES_NUMBER}`}>{GUEST_SERVICES_NUMBER}</a>
          </div>
        </Card>
      ) : (
        <ul className="faq-list">
          {results.map((f) => (
            <li key={f.id}>
              <details>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
                {f.link && <p><Link to={f.link.to}>{f.link.label}</Link></p>}
              </details>
            </li>
          ))}
        </ul>
      )}
      <p><Link to="/me/contact">{t('faq.stillStuck')}</Link></p>
    </div>
  )
}
