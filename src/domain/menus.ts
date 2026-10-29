import type { DietaryId } from './account'
import { VENUES, venueById } from './dining'
import type { Cents } from './pricing'

/** The venue directory with hours, price and menus tagged for allergens and diets (DIN-01, DIN-03). Dishes and hours are authored concept values. */
export type Contains = 'meat' | 'pork' | 'fish' | 'shellfish' | 'dairy' | 'egg' | 'gluten' | 'nuts'

export const CONTAINS: readonly Contains[] = ['meat', 'pork', 'fish', 'shellfish', 'dairy', 'egg', 'gluten', 'nuts']

export interface Dish { name: string; contains: readonly Contains[] }

export type DayType = 'sea' | 'port'
export type Hours = readonly (readonly [string, string])[]

export interface DirectoryVenue {
  id: string
  name: string
  deck: string
  placeId: string
  blurb: string
  dress: 'casual' | 'smart' | 'elegant'
  /** Included in the fare, or a specialty with a cover charge (the amount comes from the dining list). */
  price: 'included' | 'specialty' | 'casual'
  hours: Record<DayType, Hours>
  dishes: readonly Dish[]
}

const d = (name: string, ...contains: Contains[]): Dish => ({ name, contains })
const ALL: Hours = [['00:00', '24:00']]

export const DIRECTORY: readonly DirectoryVenue[] = [
  { id: 'soleil', name: 'Soleil Dining Room', deck: 'Deck 6 aft', placeId: 'soleil', blurb: 'Traditional fixed seating with the same table and waiters all week.', dress: 'smart', price: 'included',
    hours: { sea: [['17:00', '21:30']], port: [['17:00', '21:30']] },
    dishes: [d('Shrimp cocktail', 'shellfish'), d('French onion soup', 'dairy', 'gluten'), d('Roast chicken with herbs', 'meat'), d('Vegetable wellington', 'gluten', 'dairy'), d('Seared sea bass', 'fish'), d('Chocolate lava cake', 'dairy', 'egg', 'gluten', 'nuts')] },
  { id: 'eclipse', name: 'Eclipse Dining Room', deck: 'Deck 7 aft', placeId: 'eclipse', blurb: 'Anytime dining: reserve a table or walk in. Same menu as Soleil.', dress: 'smart', price: 'included',
    hours: { sea: [['07:00', '09:30'], ['12:00', '13:30'], ['17:30', '21:30']], port: [['07:00', '09:30'], ['17:30', '21:30']] },
    dishes: [d('Seared sea bass', 'fish'), d('Braised short rib', 'meat'), d('Vegetarian tasting plate', 'dairy', 'nuts'), d('Roasted cauliflower steak'), d('Caesar salad', 'egg', 'dairy', 'fish', 'gluten'), d('Seasonal fruit plate')] },
  { id: 'eatery', name: 'The Eatery', deck: 'Deck 9', placeId: 'eatery', blurb: 'The main buffet, with international and made-to-order stations.', dress: 'casual', price: 'included',
    hours: { sea: [['06:30', '22:00']], port: [['06:30', '10:30'], ['11:30', '15:00'], ['17:30', '21:30']] },
    dishes: [d('Made-to-order omelette', 'egg', 'dairy'), d('Pad thai', 'shellfish', 'nuts', 'egg'), d('Carved roast beef', 'meat'), d('Garden salad bar'), d('Steamed rice and vegetables'), d('Fresh fruit and yoghurt', 'dairy')] },
  { id: 'americana', name: 'Americana Diner', deck: 'Deck 9 aft', placeId: 'americana', blurb: 'Family-friendly classics; breakfast all day.', dress: 'casual', price: 'included',
    hours: { sea: [['07:00', '22:00']], port: [['07:00', '10:30'], ['17:00', '21:30']] },
    dishes: [d('Buttermilk pancakes', 'dairy', 'egg', 'gluten'), d('Cheeseburger', 'meat', 'dairy', 'gluten'), d('Grilled cheese', 'dairy', 'gluten'), d('Chicken tenders', 'meat', 'gluten', 'egg'), d('Fries'), d('Vanilla milkshake', 'dairy')] },
  { id: 'lido', name: 'The Lido (Lido Eats)', deck: 'Deck 17', placeId: 'lido', blurb: 'Grill, tacos, greens and pizza by the pool.', dress: 'casual', price: 'included',
    hours: { sea: [['11:00', '18:00']], port: [['11:00', '16:00']] },
    dishes: [d('Fish tacos', 'fish', 'gluten'), d('Grilled hot dog', 'pork', 'meat', 'gluten'), d('Lido greens bowl'), d('Cheese pizza slice', 'dairy', 'gluten'), d('Soft-serve cone', 'dairy')] },
  { id: 'intl-cafe', name: 'International Café', deck: 'Deck 9', placeId: 'intl-cafe', blurb: 'Open all day and night. Food is included; specialty coffee is extra.', dress: 'casual', price: 'included',
    hours: { sea: ALL, port: ALL },
    dishes: [d('Fresh sandwiches', 'gluten', 'dairy'), d('Fruit and pastry'), d('Almond biscotti', 'nuts', 'gluten', 'egg'), d('Soup of the day')] },
  { id: 'omalleys', name: 'O’Malley’s Irish Pub', deck: 'Deck 7', placeId: 'omalleys', blurb: 'Pub food and whiskey flights.', dress: 'casual', price: 'casual',
    hours: { sea: [['11:30', '23:00']], port: [['16:00', '23:00']] },
    dishes: [d('Fish and chips', 'fish', 'gluten'), d('Shepherd’s pie', 'meat', 'dairy'), d('Pretzel bites', 'gluten', 'dairy')] },
  { id: 'alfredo', name: 'Alfredo’s Pizzeria', deck: 'Deck 9 Piazza', placeId: 'alfredo', blurb: 'Neapolitan pizza, walk-in only.', dress: 'casual', price: 'casual',
    hours: { sea: [['11:30', '22:00']], port: [['16:00', '22:00']] },
    dishes: [d('Margherita', 'dairy', 'gluten'), d('Diavola', 'pork', 'meat', 'dairy', 'gluten'), d('Rocket and pear salad', 'nuts'), d('Tiramisu', 'dairy', 'egg', 'gluten')] },
  { id: 'crown', name: 'Crown Grill', deck: 'Deck 7 aft', placeId: 'crown', blurb: 'Steakhouse.', dress: 'smart', price: 'specialty',
    hours: { sea: [['17:30', '21:30']], port: [['17:30', '21:30']] },
    dishes: [d('Aged filet', 'meat'), d('Seafood tower', 'shellfish', 'fish'), d('Creamed spinach', 'dairy'), d('Baked potato', 'dairy'), d('Warm chocolate soufflé', 'egg', 'dairy', 'gluten')] },
  { id: 'sabatini', name: 'Sabatini’s', deck: 'Deck 8 aft', placeId: 'sabatini', blurb: 'Italian trattoria.', dress: 'smart', price: 'specialty',
    hours: { sea: [['17:30', '21:30']], port: [['17:30', '21:30']] },
    dishes: [d('Hand-rolled pasta with tomato', 'gluten', 'egg'), d('Veal Milanese', 'meat', 'gluten', 'egg'), d('Burrata with greens', 'dairy', 'nuts'), d('Grilled branzino', 'fish'), d('Tiramisu', 'dairy', 'egg', 'gluten')] },
  { id: 'catch', name: 'The Catch by Rudi', deck: 'Deck 7 midship', placeId: 'catch', blurb: 'Seafood.', dress: 'smart', price: 'specialty',
    hours: { sea: [['17:30', '21:30']], port: [['17:30', '21:30']] },
    dishes: [d('Lobster bisque', 'shellfish', 'dairy'), d('Grilled catch of the day', 'fish'), d('Roasted corn salad'), d('Key lime tart', 'dairy', 'egg', 'gluten')] },
  { id: 'love', name: 'Love by Britto', deck: 'Deck 17 aft', placeId: 'love', blurb: 'Five small courses with a view of the wake.', dress: 'elegant', price: 'specialty',
    hours: { sea: [['18:00', '21:30']], port: [['18:00', '21:30']] },
    dishes: [d('Beetroot and goat cheese', 'dairy', 'nuts'), d('Scallop crudo', 'shellfish'), d('Duck breast', 'meat'), d('Mushroom risotto', 'dairy'), d('Passion fruit sorbet')] },
]

export const directoryVenue = (id: unknown): DirectoryVenue | undefined => DIRECTORY.find((v) => v.id === id)

/** The cover charge per person for a specialty venue, from the reservation list; null where there is none. */
export function coverOf(v: DirectoryVenue): Cents | null {
  const venue = venueById(v.id)
  return venue && venue.cover > 0 ? venue.cover : null
}

/** A venue the reservation list also knows (so it can be booked ahead). */
export const reservableVenue = (v: DirectoryVenue): boolean => VENUES.some((x) => x.id === v.id && !x.walkIn && x.kind !== 'casual')

const AVOID: Record<DietaryId, readonly Contains[]> = {
  vegetarian: ['meat', 'pork', 'fish', 'shellfish'],
  vegan: ['meat', 'pork', 'fish', 'shellfish', 'dairy', 'egg'],
  glutenFree: ['gluten'],
  nutAllergy: ['nuts'],
  shellfishAllergy: ['shellfish'],
  dairyFree: ['dairy'],
  // Halal and kosher cannot be confirmed from a tag: these only remove what is clearly out, and the screen tells the guest to ask.
  halal: ['pork'],
  kosher: ['pork', 'shellfish'],
}

/** Whether a dish has nothing the diet avoids. */
export const dishSuits = (dish: Dish, diet: DietaryId): boolean => !AVOID[diet].some((c) => dish.contains.includes(c))

/** The dishes that suit every diet in the list (an empty list keeps every dish). */
export const dishesFor = (v: DirectoryVenue, diets: readonly DietaryId[]): Dish[] => v.dishes.filter((x) => diets.every((diet) => dishSuits(x, diet)))

/** Diets whose tags are not enough to promise anything, so the guest must ask the maître d'. */
export const NEEDS_ASKING: readonly DietaryId[] = ['halal', 'kosher']

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

/** Whether the venue is open at a ship-time "HH:MM" on a type of day. */
export function openAt(v: DirectoryVenue, day: DayType, time: string): boolean {
  const at = mins(time)
  return v.hours[day].some(([from, to]) => at >= mins(from) && at < mins(to))
}

/** "7:00 am to 9:30 am, 12:00 pm to 1:30 pm", or "Open all day and night". */
export function hoursText(hours: Hours, format: (time: string) => string): string {
  if (hours.length === 1 && hours[0][0] === '00:00' && hours[0][1] === '24:00') return ''
  return hours.map(([a, b]) => `${format(a)} to ${format(b === '24:00' ? '23:59' : b)}`).join(', ')
}
