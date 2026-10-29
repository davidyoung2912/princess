import type { PackageId, Persona, Tier } from './personas'

/**
 * The entitlement engine (PRE-16): one place that works out what a guest gets from fare, package, Captain's Circle tier
 * and suite class. Figures are authored mock values, not Princess's terms.
 */
export interface Entitlements {
  /** Highest price of a single drink the package covers, in dollars; 0 when there is no drinks package. */
  drinkCapUsd: number
  wifiDevices: number
  /** Specialty dinners included for the whole sailing. */
  specialtyMeals: number
  excursionCreditUsd: number
  gratuitiesIncluded: boolean
  /** Dining reservations open at booking (Elite, Platinum) or after full payment. */
  diningWindow: 'atBooking' | 'afterFullPayment'
  /** Plain-language perks that have no number. */
  perks: PerkId[]
}

export type PerkId = 'priorityEmbarkation' | 'priorityDisembarkation' | 'freeLaundry' | 'suiteLounge' | 'welcomeGift' | 'memberEvents'

export interface Source {
  tier: Tier
  package: PackageId
  sanctuary: boolean
}

export const sourceOf = (p: Persona): Source => ({ tier: p.tier, package: p.package, sanctuary: p.sanctuary })

const BASE: Entitlements = { drinkCapUsd: 0, wifiDevices: 0, specialtyMeals: 0, excursionCreditUsd: 0, gratuitiesIncluded: false, diningWindow: 'afterFullPayment', perks: [] }

const PACKAGES: Record<PackageId, Partial<Entitlements>> = {
  none: {},
  plus: { drinkCapUsd: 15, wifiDevices: 1, specialtyMeals: 2, gratuitiesIncluded: true },
  premier: { drinkCapUsd: 20, wifiDevices: 4, specialtyMeals: 3, gratuitiesIncluded: true, excursionCreditUsd: 100 },
}

const TIERS: Record<Tier, { wifi: number; perks: PerkId[]; window: Entitlements['diningWindow'] }> = {
  none: { wifi: 0, perks: [], window: 'afterFullPayment' },
  gold: { wifi: 0, perks: ['memberEvents'], window: 'afterFullPayment' },
  ruby: { wifi: 0, perks: ['memberEvents', 'welcomeGift'], window: 'afterFullPayment' },
  platinum: { wifi: 1, perks: ['memberEvents', 'welcomeGift', 'priorityEmbarkation', 'priorityDisembarkation', 'freeLaundry'], window: 'atBooking' },
  elite: { wifi: 2, perks: ['memberEvents', 'welcomeGift', 'priorityEmbarkation', 'priorityDisembarkation', 'freeLaundry'], window: 'atBooking' },
}

const SANCTUARY = { specialtyMeals: 1, perks: ['suiteLounge', 'priorityEmbarkation', 'priorityDisembarkation'] as PerkId[] }

/** What a guest gets. Numbers add up across sources (a package's Wi-Fi plus the tier's); the best dining window and cap win. */
export function computeEntitlements(src: Source): Entitlements {
  const pkg = PACKAGES[src.package]
  const tier = TIERS[src.tier]
  const suitePerks: PerkId[] = src.sanctuary ? SANCTUARY.perks : []
  return {
    drinkCapUsd: pkg.drinkCapUsd ?? BASE.drinkCapUsd,
    wifiDevices: (pkg.wifiDevices ?? 0) + tier.wifi,
    specialtyMeals: (pkg.specialtyMeals ?? 0) + (src.sanctuary ? SANCTUARY.specialtyMeals : 0),
    excursionCreditUsd: pkg.excursionCreditUsd ?? 0,
    gratuitiesIncluded: pkg.gratuitiesIncluded ?? false,
    diningWindow: tier.window,
    perks: [...new Set([...tier.perks, ...suitePerks])],
  }
}

export interface Usage {
  specialtyMeals: number
  wifiDevices: number
  excursionCreditUsd: number
}

export interface Balance {
  total: number
  used: number
  remaining: number
}

export type BalanceKey = keyof Usage

/** Used and remaining for the countable entitlements ("what's included for me", with a running balance). Overuse shows as zero remaining. */
export function balances(e: Entitlements, used: Partial<Usage> = {}): Record<BalanceKey, Balance> {
  const one = (total: number, u = 0): Balance => ({ total, used: Math.min(u, total), remaining: Math.max(0, total - u) })
  return {
    specialtyMeals: one(e.specialtyMeals, used.specialtyMeals),
    wifiDevices: one(e.wifiDevices, used.wifiDevices),
    excursionCreditUsd: one(e.excursionCreditUsd, used.excursionCreditUsd),
  }
}
