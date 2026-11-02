import { ADD_ON_IDS, replacePackages, type AddOn, type AddOnId, type Unit } from './packages'
import { notifyCatalogue } from './catalogueServed'

/**
 * The add-ons from the server (multi-device plan 3, Phase 3 step 5): names, blurbs, units, base prices and price changes, the average drink and
 * cover figures the worth-it screens use, and the refund window. The authored values in `packages.ts` show until it arrives; the last answer is
 * kept on the device as a cache. Prices a guest pays are still worked out by the server.
 */
export interface ServedPackages { version: string; addOns: AddOn[]; avgDrink: number; serviceCharge: number; avgCover: number; cancelUntilDays: number }

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 400): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const UNITS: readonly string[] = ['personNight', 'person', 'room']

function addOn(r: unknown): AddOn | null {
  if (!rec(r) || !(ADD_ON_IDS as readonly unknown[]).includes(r.id) || !str(r.name, 80) || !str(r.blurb) || !str(r.unit, 20) || !UNITS.includes(r.unit)) return null
  if (!num(r.base, 0, 100_000_000) || !Number.isInteger(r.base) || !num(r.changeAtDays, 0, 365) || !Number.isInteger(r.changeAtDays) || !num(r.changeShare, -1, 5) || !num(r.minAge, 0, 120) || !Number.isInteger(r.minAge)) return null
  return { id: r.id as AddOnId, name: r.name, blurb: r.blurb, unit: r.unit as Unit, base: r.base, change: { atDays: r.changeAtDays, share: r.changeShare }, minAge: r.minAge }
}

/** Reads the server's answer, all or nothing: every add-on id must be listed once, with sound figures. */
export function normalizePackages(raw: unknown): ServedPackages | null {
  if (!rec(raw) || !str(raw.version, 80) || !Array.isArray(raw.addOns)) return null
  const list = raw.addOns.map(addOn)
  if (list.some((a) => !a)) return null
  const addOns = list as AddOn[]
  if (addOns.length !== ADD_ON_IDS.length || new Set(addOns.map((a) => a.id)).size !== addOns.length) return null
  if (!num(raw.avgDrink, 1, 1_000_000) || !num(raw.serviceCharge, 0, 1) || !num(raw.avgCover, 1, 10_000_000) || !num(raw.cancelUntilDays, 0, 365) || !Number.isInteger(raw.cancelUntilDays)) return null
  return { version: raw.version, addOns, avgDrink: raw.avgDrink, serviceCharge: raw.serviceCharge, avgCover: raw.avgCover, cancelUntilDays: raw.cancelUntilDays }
}

/** Puts the served add-ons in use and tells the screens. */
export function applyPackages(p: ServedPackages): void {
  replacePackages(p)
  notifyCatalogue()
}
