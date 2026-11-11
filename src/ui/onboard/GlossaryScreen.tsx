import { Link } from 'react-router'
import { glossaryByLetter } from '../../domain/glossary'
import { t } from '../../i18n'

const GROUPS = glossaryByLetter()

/** The nautical glossary: terms heard on board and what they mean, A to Z, with a row of letters to jump to. */
export function GlossaryScreen() {
  return (
    <div className="page">
      <p>{t('gloss.intro')}</p>
      <nav aria-label={t('gloss.jump')}>
        <ul className="naut-jump">
          {GROUPS.map((g) => <li key={g.letter}><a href={`#gloss-${g.letter}`}>{g.letter}</a></li>)}
        </ul>
      </nav>
      {GROUPS.map((g) => (
        <section key={g.letter} id={`gloss-${g.letter}`} aria-labelledby={`gloss-${g.letter}-h`}>
          <h2 id={`gloss-${g.letter}-h`}>{g.letter}</h2>
          <dl className="facts">
            {g.terms.map((x) => (
              <div key={x.term}>
                <dt>{x.term}</dt>
                <dd>{x.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p><Link to="/nautical">{t('route.nautical')}</Link></p>
    </div>
  )
}
