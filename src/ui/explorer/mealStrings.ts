import type { MealMenu } from '../../api/explorerTypes'
import type { StringKey } from '../../i18n'

/** The words for each meal of a menu. */
export const MEAL: Record<MealMenu['meal'], StringKey> = { breakfast: 'exp.meal.breakfast', brunch: 'exp.meal.brunch', lunch: 'exp.meal.lunch', tea: 'exp.meal.tea', dinner: 'exp.meal.dinner', allDay: 'exp.meal.allDay' }
