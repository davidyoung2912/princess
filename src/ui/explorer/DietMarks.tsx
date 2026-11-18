import type { DietMark, DishFlag } from '../../api/explorerTypes'
import { t, type StringKey } from '../../i18n'
import { DietNas, DietVegan, DietVegetarian, FlagAlcohol, FlagRaw, FlagSpicy } from '../icons'

const ICON = { vegan: DietVegan, vegetarian: DietVegetarian, nas: DietNas } as const
const LABEL: Record<DietMark, StringKey> = { vegan: 'exp.diet.vegan', vegetarian: 'exp.diet.vegetarian', nas: 'exp.diet.nas' }
/** What a mark means, where its name does not already say it (No added sugar needs no explanation). */
const WHAT: Record<DietMark, StringKey | null> = { vegan: 'exp.diet.vegan.what', vegetarian: 'exp.diet.vegetarian.what', nas: null }
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
      {ORDER.map((m) => <li key={m}><DietMarkIcon mark={m} /> <span>{t(LABEL[m])}</span>{WHAT[m] && <> <small className="muted">{t(WHAT[m])}</small></>}</li>)}
    </ul>
  )
}

const FLAG_ICON = { alcohol: FlagAlcohol, raw: FlagRaw, spicy: FlagSpicy } as const
const FLAG_LABEL: Record<DishFlag, StringKey> = { alcohol: 'exp.flag.alcohol', raw: 'exp.flag.raw', spicy: 'exp.flag.spicy' }
const FLAG_WHAT: Record<DishFlag, StringKey | null> = { alcohol: 'exp.flag.alcohol.what', raw: null, spicy: 'exp.flag.spicy.what' }
const FLAG_ORDER: readonly DishFlag[] = ['alcohol', 'raw', 'spicy']

/** One heads-up beside a dish (alcohol, raw or undercooked, spicy): an icon with a name for a screen reader, in a different shape from the diet marks so it is never read as one. */
export function DishFlagIcon({ flag }: { flag: DishFlag }) {
  const Icon = FLAG_ICON[flag]
  return <span className={`diet-mark dish-flag dish-flag--${flag}`} role="img" aria-label={t(FLAG_LABEL[flag])} title={t(FLAG_LABEL[flag])}><Icon aria-hidden="true" focusable="false" /></span>
}

/** The heads-ups of a dish, always in the same order. */
export function DishFlags({ flags }: { flags?: readonly DishFlag[] }) {
  const shown = FLAG_ORDER.filter((f) => flags?.includes(f))
  if (shown.length === 0) return null
  return <span className="diet-marks">{shown.map((f) => <DishFlagIcon key={f} flag={f} />)}</span>
}

/** A written call-out under a dish that carries a heads-up the guest asked to be told about (words, not colour alone). */
export function AvoidNote({ flags }: { flags: readonly DishFlag[] }) {
  if (flags.length === 0) return null
  return <small className="dish-avoid">{t('exp.flag.avoid', { list: FLAG_ORDER.filter((f) => flags.includes(f)).map((f) => t(FLAG_LABEL[f]).toLowerCase()).join(', ') })}</small>
}

/** What the heads-ups mean, for the flags the menu actually uses. */
export function FlagLegend({ used }: { used: readonly DishFlag[] }) {
  const shown = FLAG_ORDER.filter((f) => used.includes(f))
  if (shown.length === 0) return null
  return (
    <ul className="diet-legend" aria-label={t('exp.flag.legend')}>
      {shown.map((f) => <li key={f}><DishFlagIcon flag={f} /> <span>{t(FLAG_LABEL[f])}</span>{FLAG_WHAT[f] && <> <small className="muted">{t(FLAG_WHAT[f])}</small></>}</li>)}
    </ul>
  )
}
