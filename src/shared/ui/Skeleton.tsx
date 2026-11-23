import { t } from '../i18n'

/** A loading placeholder shaped like a page: a heading, a card and a few rows. It stays still under reduced motion (the shimmer is CSS). Announced once as "Loading". */
export function PageSkeleton() {
  return (
    <div className="page skeleton" role="status" aria-busy="true">
      <span className="visually-hidden">{t('shell.loading')}</span>
      <div className="skeleton__bar skeleton__bar--title" aria-hidden="true" />
      <div className="skeleton__card" aria-hidden="true" />
      {[0, 1, 2].map((i) => <div key={i} className="skeleton__bar" aria-hidden="true" />)}
    </div>
  )
}
