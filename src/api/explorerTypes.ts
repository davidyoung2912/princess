import type { Cents } from '../domain/money'
import type { ExplorerKind, EventStatus, Window } from '../domain/explorer/types'

// The wire shapes of the Explorer pages (server/Princess.Api/Domain/ExplorerRules.cs). Instants are epoch ms, times are ship time "HH:MM", dates "YYYY-MM-DD".

/** A place a guest can go in one Explorer, as the server describes it. */
export interface ExplorerVenueInfo {
  id: string
  shipId: string
  explorer: ExplorerKind
  /** What sort of place it is inside its Explorer, for the filter chips ("main", "specialty", "casual"...). */
  kind: string
  title: string
  short: string
  long: string
  placeId: string
  deckLabel: string
  cover?: Cents
  minAge?: number
  bookable: 'none' | 'dining' | 'spa'
  order: number
  features: string[]
  accessibility: string[]
  /** Restaurants: seating and care for little ones. */
  family?: string[]
  /** Restaurants: the dishes on the children's menu. */
  kidsMenu?: MealDish[]
}

/** A venue's hours for the chosen day, worked out by the server. */
export interface HoursDay {
  windows: Window[]
  staffed: Window[]
  /** Why it is closed all day: the ship is alongside, or there are no hours for the day. */
  closedBecause: 'alongside' | 'none' | null
}

export interface ExplorerEvent {
  id: string
  venueId: string
  day: number
  date: string
  start: string
  minutes: number
  startAt: number
  endAt: number
  title: string
  detail: string
  age: 'all' | 'kids' | 'teens' | 'adults'
  interest: string
  /** Extra cost per person; 0 is in the fare. */
  extra: Cents
  status: EventStatus
  /** The time before a move, "HH:MM". */
  was?: string
  reason?: string
  /** The places there are, when limited, and the places not yet taken by other guests. */
  capacity?: number
  left?: number
  performer?: string
  /** The name shared by showings or rounds that belong together. */
  series?: string
  /** Access codes (`AccessFeature` in `domain/eventAccess`). */
  access?: string[]
  dress?: string
  arrive?: string
}

export type DietMark = 'vegan' | 'vegetarian' | 'nas'
export type DishFlag = 'alcohol' | 'raw' | 'spicy'
export interface MealDish { name: string; contains: string[]; note?: string; /** Vegan, vegetarian and NAS (no added sugar), as the ship marks the dish. */ marks?: DietMark[]; /** Heads-ups: alcohol in the dish, raw or undercooked food, a spicy kick. Not diets: a flag never says a dish suits anyone. */ flags?: DishFlag[] }
export interface MealCourse { name: string; dishes: MealDish[] }

export interface MealMenu {
  venueId: string
  meal: 'breakfast' | 'brunch' | 'lunch' | 'tea' | 'dinner' | 'allDay'
  from: string
  to: string
  title: string
  theme?: string
  formal: boolean
  courses: MealCourse[]
}

/** One venue on one day: its hours, its events and (on its own page) its menus. */
export interface VenueDay {
  venue: ExplorerVenueInfo
  hours: HoursDay
  events: ExplorerEvent[]
  menus: MealMenu[]
}

/** One Explorer on one day: every venue with the day's hours and events, and the events the signed-in person has planned. */
export interface ExplorerDay {
  explorer: ExplorerKind
  shipId: string
  day: number
  /** The ship's cruise day now, or absent outside the cruise. */
  currentDay?: number
  date: string
  port: string
  shipZone: string
  /** When the ship sails this day, if it does. */
  sailawayAt?: number
  venues: VenueDay[]
  mine: string[]
  /** The reminder chosen for a planned event (minutes ahead, 0 off); an event with none follows the notification preference. */
  reminders?: Record<string, number>
}

/** One saved item of the shortlist with its name, resolved by the server so it needs no booking. `venueId` is the place it is at (none for a tour); `shipId` the ship (none for a tour). */
export interface SavedItemView {
  key: string
  kind: 'venue' | 'treatment' | 'event' | 'tour' | 'dish'
  title: string
  explorer: 'dining' | 'entertainment' | 'shopping' | 'spa' | 'exercise' | 'activities' | 'excursions'
  itemId: string
  venueId: string | null
  shipId: string | null
  /** Where a dish is served (its venue's name). */
  detail?: string | null
}
