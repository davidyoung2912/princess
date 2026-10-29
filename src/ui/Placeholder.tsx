import { Link } from 'react-router'
import { t } from '../i18n'
import { childLinks } from '../routes/nav'
import type { RouteDef } from '../routes/routes'
import { Card } from './Card'
import { ConceptNotice } from './ConceptNotice'

/** The stand-in for a screen that a later phase builds: the title, what phase brings it, and links to the screens below it. */
export function Placeholder({ route }: { route: RouteDef }) {
  const links = childLinks(route.path)
  return (
    <div className="page">
      <h1>{t(route.titleKey)}</h1>
      <Card info>
        <p>{t('placeholder.later', { phase: route.phase })}</p>
      </Card>
      {links.length > 0 && (
        <section aria-labelledby="below-h">
          <h2 id="below-h">{t('placeholder.below')}</h2>
          <ul className="link-list">
            {links.map((child) => (
              <li key={child.path}>
                <Link to={child.path.replace(':id', 'sample')}>{t(child.titleKey)}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {route.notice && <ConceptNotice />}
    </div>
  )
}
