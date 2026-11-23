import { Link } from 'react-router'
import type { StringKey } from '../../../shared/i18n'
import { t } from '../../../shared/i18n'
import { DIET_MARKS } from '../domain/urlFilter'
import { DINING_PROMPTS, DINING_SORTS, MEAL_PERIODS, NO_DINING_FILTER, isFiltering, type DiningFilter, type DiningPrompt, type DiningSort, type MealPeriod } from '../domain/diningDiscovery'
import { Button } from '../../../shared/ui/Button'
import { Chip } from '../../../shared/ui/Chip'
import { FilterChips } from './Parts'

const PERIOD: Record<MealPeriod, StringKey> = { breakfast: 'exp.meal.breakfast', lunch: 'exp.meal.lunch', dinner: 'exp.meal.dinner', late: 'exp.dining.period.late' }
const PROMPT: Record<DiningPrompt, StringKey> = { quick: 'exp.dining.prompt.quick', family: 'exp.dining.prompt.family', occasion: 'exp.dining.prompt.occasion', included: 'exp.dining.prompt.included', late: 'exp.dining.prompt.late' }
const SORT: Record<DiningSort, StringKey> = { suggested: 'exp.dining.sort.suggested', open: 'exp.dining.sort.open', price: 'exp.dining.sort.price' }

interface Props {
  kinds: readonly string[]
  kindLabels: Record<string, string>
  filter: DiningFilter
  onFilter: (f: DiningFilter) => void
  sort: DiningSort
  onSort: (s: DiningSort) => void
  /** Whether any place on the list has a children's menu, so the chip is offered only when it can match. */
  anyKidsMenu: boolean
}

/** The Dining Explorer's discovery controls: meal period, ready-made prompts, children's menu, kind of place, dish search and sort. */
export function DiningControls({ kinds, kindLabels, filter, onFilter, sort, onSort, anyKidsMenu }: Props) {
  const set = (patch: Partial<DiningFilter>) => onFilter({ ...filter, ...patch })
  return (
    <>
      <div role="group" aria-label={t('exp.dining.period.label')} className="chip-row">
        {MEAL_PERIODS.map((p) => <Chip key={p} pressed={filter.period === p} onToggle={() => set({ period: filter.period === p ? null : p })}>{t(PERIOD[p])}</Chip>)}
        <Link className="chip" to="/ship/order">{t('exp.dining.roomService')}</Link>
      </div>
      <div role="group" aria-label={t('exp.dining.prompt.label')} className="chip-row">
        {DINING_PROMPTS.map((p) => <Chip key={p} pressed={filter.prompt === p} onToggle={() => set({ prompt: filter.prompt === p ? null : p })}>{t(PROMPT[p])}</Chip>)}
        {anyKidsMenu && <Chip pressed={filter.kidsMenu} onToggle={() => set({ kidsMenu: !filter.kidsMenu })}>{t('exp.dining.kidsMenu')}</Chip>}
      </div>
      <div data-tour="dine-diet" role="group" aria-label={t('exp.dining.diet.label')} className="chip-row">
        {DIET_MARKS.map((d) => <Chip key={d} pressed={filter.diet === d} onToggle={() => set({ diet: filter.diet === d ? null : d })}>{t(`exp.dining.diet.${d}` as StringKey)}</Chip>)}
      </div>
      {filter.diet !== null && <p className="muted">{t('exp.dining.diet.note')}</p>}
      <FilterChips kinds={kinds} label={t('exp.filter.label')} value={filter.kind} onChange={(kind) => set({ kind })} labels={kindLabels} />
      <div className="field">
        <label htmlFor="exp-search">{t('exp.dining.search.label')}</label>
        <input id="exp-search" type="search" value={filter.query} onChange={(e) => set({ query: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="exp-sort">{t('exp.dining.sort.label')}</label>
        <select id="exp-sort" className="field__input" value={sort} onChange={(e) => onSort(e.target.value as DiningSort)}>
          {DINING_SORTS.map((s) => <option key={s} value={s}>{t(SORT[s])}</option>)}
        </select>
      </div>
      {isFiltering(filter) && <Button variant="secondary" className="exp-clear" onClick={() => onFilter(NO_DINING_FILTER)}>{t('exp.dining.clear')}</Button>}
    </>
  )
}
