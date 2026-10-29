import { computeEntitlements } from './entitlements'
import { FARES } from './fares'
import { GRATUITY_PER_NIGHT, NIGHTS, type Cents } from './pricing'
import type { PackageId } from './personas'

/** Packages and add-ons (PRE-06, PRE-17). Prices are authored concept values, not Princess's. */
export type AddOnId = 'drinks' | 'wifi' | 'specialtyPass' | 'photo' | 'laundry'
export const ADD_ON_IDS: readonly AddOnId[] = ['drinks', 'wifi', 'specialtyPass', 'photo', 'laundry']

/** How an add-on is counted: each person each night, each person, or once for the stateroom. */
export type Unit = 'personNight' | 'person' | 'room'

export interface AddOn {
  id: AddOnId
  name: string
  blurb: string
  unit: Unit
  /** Price before any change. */
  base: Cents
  /** The price moves on this many days before sailing: from then on it is `base` changed by `share` (up if positive). */
  change: { atDays: number; share: number }
  /** Only guests this old or older can have it. */
  minAge: number
}

export const ADD_ONS: Record<AddOnId, AddOn> = {
  drinks: { id: 'drinks', name: 'Drinks package', blurb: 'Cocktails, wine by the glass, beer and coffee, up to $15 a drink, with the gratuity included.', unit: 'personNight', base: 5200, change: { atDays: 15, share: 0.13 }, minAge: 21 },
  wifi: { id: 'wifi', name: 'Wi-Fi, one device', blurb: 'Messaging and browsing for one phone or tablet all cruise.', unit: 'personNight', base: 2500, change: { atDays: 20, share: 0.2 }, minAge: 0 },
  specialtyPass: { id: 'specialtyPass', name: 'Specialty dining pass', blurb: 'Three dinners at Crown Grill, Sabatini’s, The Catch or Love by Britto.', unit: 'person', base: 12900, change: { atDays: 15, share: 0.1 }, minAge: 0 },
  photo: { id: 'photo', name: 'Photo package', blurb: 'Every photo the ship’s photographers take of you, to download.', unit: 'person', base: 14900, change: { atDays: 10, share: -0.2 }, minAge: 0 },
  laundry: { id: 'laundry', name: 'Laundry package', blurb: 'Wash and fold, with up to five bags for the whole stateroom.', unit: 'room', base: 9900, change: { atDays: 0, share: 0 }, minAge: 0 },
}

export const isAddOnId = (v: unknown): v is AddOnId => ADD_ON_IDS.includes(v as AddOnId)

const wholeDollars = (cents: number): Cents => Math.round(cents / 100) * 100

/** The price of one unit on a day: the base price until the change date, then the changed price (PRE-17). */
export function unitPrice(base: Cents, change: { atDays: number; share: number }, daysToDeparture: number): Cents {
  return daysToDeparture >= change.atDays || change.share === 0 ? base : wholeDollars(base * (1 + change.share))
}

export const addOnPrice = (id: AddOnId, daysToDeparture: number): Cents => unitPrice(ADD_ONS[id].base, ADD_ONS[id].change, daysToDeparture)

/** How many units a purchase covers. */
export function units(unit: Unit, guests: number): number {
  return unit === 'room' ? 1 : unit === 'person' ? guests : guests * NIGHTS
}

export interface PackageUpgrade {
  from: PackageId
  to: Exclude<PackageId, 'none'>
  /** Per guest, with the gratuities already in the fare credited. */
  base: Cents
  change: { atDays: number; share: number }
}

/** What moving up to Plus or Premier after booking costs per guest: the package price less the gratuities the fare already includes. */
export function upgradeBase(from: PackageId, to: Exclude<PackageId, 'none'>): Cents {
  const have = from === 'none' ? GRATUITY_PER_NIGHT : FARES[from].perNight
  return Math.max(0, (FARES[to].perNight - have) * NIGHTS)
}

const RISE = { atDays: 15, share: 0.1 }

/** The upgrades a guest can buy from where they are. */
export function upgradesFrom(from: PackageId): PackageUpgrade[] {
  const targets: Exclude<PackageId, 'none'>[] = from === 'none' ? ['plus', 'premier'] : from === 'plus' ? ['premier'] : []
  return targets.map((to) => ({ from, to, base: upgradeBase(from, to), change: RISE }))
}

export const upgradePrice = (u: PackageUpgrade, daysToDeparture: number): Cents => unitPrice(u.base, u.change, daysToDeparture)

/** The better of two packages. */
export const bestPackage = (a: PackageId, b: PackageId): PackageId => {
  const order: PackageId[] = ['none', 'plus', 'premier']
  return order[Math.max(order.indexOf(a), order.indexOf(b))]
}

export type PriceState = 'locked' | 'dropped' | 'same'

/** Price-change protection: a purchase made before a rise keeps its price ("locked"); one made before a drop is owed the difference ("dropped"). */
export function priceState(paidUnit: Cents, nowUnit: Cents): { state: PriceState; perUnit: Cents } {
  if (paidUnit < nowUnit) return { state: 'locked', perUnit: nowUnit - paidUnit }
  if (paidUnit > nowUnit) return { state: 'dropped', perUnit: paidUnit - nowUnit }
  return { state: 'same', perUnit: 0 }
}

/** Purchases can be cancelled for a full refund until this many days before sailing. */
export const CANCEL_UNTIL_DAYS = 3
export const canCancelPurchase = (daysToDeparture: number): boolean => daysToDeparture >= CANCEL_UNTIL_DAYS

// ---- "Is it worth it?" ----

/** The average price of one drink on board, before the 18% service charge. */
export const AVG_DRINK: Cents = 1100
export const SERVICE_CHARGE = 0.18
/** Average cover charge across the specialty restaurants. */
export const AVG_COVER: Cents = 4500

export interface Usage {
  drinksPerDay: number
  specialtyDinners: number
  wifi: boolean
  /** Dollars of tours the guest expects to book. */
  excursionSpend: number
  avgDrink: Cents
}

export const DEFAULT_USAGE: Usage = { drinksPerDay: 4, specialtyDinners: 2, wifi: true, excursionSpend: 150, avgDrink: AVG_DRINK }

export interface Worth {
  /** What the guest would pay without it. */
  without: Cents
  /** What it costs. */
  cost: Cents
  /** Without minus cost; negative means it costs more than it saves. */
  savings: Cents
  worthIt: boolean
}

const verdict = (without: Cents, cost: Cents): Worth => ({ without, cost, savings: without - cost, worthIt: without > cost })

/** Cost of drinks bought one at a time over the cruise, with the service charge. */
export const drinksWithout = (perDay: number, avgDrink: Cents = AVG_DRINK): Cents => Math.round(Math.max(0, perDay) * avgDrink * (1 + SERVICE_CHARGE)) * NIGHTS

/** Drinks per day at which the drinks package costs the same as buying drinks one at a time. */
export function breakEvenDrinks(unit: Cents, avgDrink: Cents = AVG_DRINK): number {
  return Math.ceil((unit / (avgDrink * (1 + SERVICE_CHARGE))) * 10) / 10
}

/** The drinks package for one guest against buying drinks one at a time. */
export function drinksWorth(unit: Cents, use: Pick<Usage, 'drinksPerDay' | 'avgDrink'>): Worth {
  return verdict(drinksWithout(use.drinksPerDay, use.avgDrink), unit * NIGHTS)
}

/** What a guest would otherwise pay for the things a package includes, for the sailing, given how they expect to spend. */
export function includedValue(pkg: PackageId, use: Usage, wifiNight: Cents = ADD_ONS.wifi.base): Cents {
  const e = computeEntitlements({ tier: 'none', package: pkg, sanctuary: false })
  const drinks = e.drinkCapUsd > 0 ? drinksWithout(use.drinksPerDay, Math.min(use.avgDrink, e.drinkCapUsd * 100)) : 0
  const wifi = e.wifiDevices > 0 && use.wifi ? wifiNight * NIGHTS : 0
  const dinners = Math.min(use.specialtyDinners, e.specialtyMeals) * AVG_COVER
  const tours = Math.min(use.excursionSpend * 100, e.excursionCreditUsd * 100)
  return drinks + wifi + dinners + tours
}

/** Moving up a package against paying for the same things one at a time. */
export function packageWorth(from: PackageId, to: PackageId, cost: Cents, use: Usage, wifiNight: Cents = ADD_ONS.wifi.base): Worth {
  return verdict(includedValue(to, use, wifiNight) - includedValue(from, use, wifiNight), cost)
}

export interface SeedPurchase {
  item: AddOnId
  /** People it covers. */
  guests: string[]
  /** Days before sailing that it was bought. */
  boughtDaysBefore: number
}

/** Add-ons a few demo people already hold, bought before a price change, so price protection can be seen. */
export const SEEDED_PURCHASES: Record<string, readonly SeedPurchase[]> = {
  marcus: [{ item: 'drinks', guests: ['marcus', 'elena'], boughtDaysBefore: 40 }],
  gerald: [{ item: 'photo', guests: ['gerald'], boughtDaysBefore: 30 }],
}
