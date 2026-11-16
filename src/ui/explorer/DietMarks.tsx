import type { DietMark } from '../../api/explorerTypes'
import { t, type StringKey } from '../../i18n'
import { DietNas, DietVegan, DietVegetarian } from '../icons'

const ICON = { vegan: DietVegan, vegetarian: DietVegetarian, nas: DietNas } as const
const LABEL: Record<DietMark, StringKey> = { vegan: 'exp.diet.vegan', vegetarian: 'exp.diet.vegetarian', nas: 'exp.diet.nas' }
const WHAT: Record<DietMark, StringKey> = { vegan: 'exp.diet.vegan.what', vegetarian: 'exp.diet.vegetarian.what', nas: 'exp.diet.nas.what' }
const ORDER: readonly DietMark[] = ['vegan', 'vegetarian', 'nas']

/** One mark beside a dish: an icon that says what it is to the eye and to a screen reader (the colour is never the only sign). */
export function DietMarkIcon({ mark }: { mark: DietMark }) {
  const Icon = ICON[mark]
  return <span className={`diet-mark diet-mark--${mark}`} role="img" aria-label={t(LABEL[mark])} title={t(LABEL[mark])}><Icon aria-hidden="true" focusable="false" /></span>
}

/** The marks of a dish, always in the same order. */
export function DietMarks({ marks }: { marks?: readonly DietMark[] }) {
  const shown = ORDER.filter((m) => marks?.includes(m))
  if (shown.length === 0) return null
  return <span className="diet-marks">{shown.map((m) => <DietMarkIcon key={m} mark={m} />)}</span>
}

/** What the marks mean, shown above a menu that uses them. */
export function DietLegend() {
  return (
    <ul className="diet-legend" aria-label={t('exp.diet.legend')}>
      {ORDER.map((m) => <li key={m}><DietMarkIcon mark={m} /> <span>{t(LABEL[m])}</span> <small className="muted">{t(WHAT[m])}</small></li>)}
    </ul>
  )
}
