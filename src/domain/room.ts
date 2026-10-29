import type { StateroomKind } from './personas'

/**
 * The stateroom (ROM-01, ROM-02, ROM-03, ROM-05): the information card, housekeeping preferences, Do Not Disturb, and
 * mock smart-room controls. The door cannot be unlocked from a web page (ROM-04), so the keycard stays the key.
 * Names, amenities and ranges are authored concept values (verify before real use).
 */
export const STEWARDS: readonly string[] = ['Marisol', 'Dennis', 'Aiko', 'Rafael', 'Joy', 'Tomas']

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export const stewardFor = (cabin: string): string => STEWARDS[hash(cabin) % STEWARDS.length]

export type Amenity = 'bed' | 'bath' | 'tv' | 'safe' | 'fridge' | 'balcony' | 'window' | 'sitting' | 'accessible'

const BASE: readonly Amenity[] = ['bed', 'bath', 'tv', 'safe']

const AMENITIES: Record<StateroomKind, readonly Amenity[]> = {
  interior: BASE,
  oceanview: [...BASE, 'window'],
  balcony: [...BASE, 'balcony', 'fridge'],
  accessibleBalcony: [...BASE, 'balcony', 'fridge', 'accessible'],
  miniSuite: [...BASE, 'balcony', 'fridge', 'sitting'],
  familyBalcony: [...BASE, 'balcony', 'fridge', 'sitting'],
  connectingBalcony: [...BASE, 'balcony', 'fridge'],
}

export const amenitiesFor = (kind: StateroomKind): readonly Amenity[] => AMENITIES[kind]

/** Whether there is a window or balcony to open the shades on. */
export const hasView = (kind: StateroomKind): boolean => AMENITIES[kind].includes('window') || AMENITIES[kind].includes('balcony')

export const CLEANING_WINDOWS = ['any', 'morning', 'midday', 'afternoon', 'evening'] as const
export type CleaningWindow = (typeof CLEANING_WINDOWS)[number]

export const SERVICE_MODES = ['none', 'dnd', 'makeUp'] as const
export type ServiceMode = (typeof SERVICE_MODES)[number]

export const LIGHTS = ['off', 'dim', 'bright'] as const
export type Lights = (typeof LIGHTS)[number]

export const TEMP_RANGE = { min: 62, max: 78 } as const

export interface Housekeeping { mode: ServiceMode; window: CleaningWindow; turndown: boolean; /** When the mode was set. */ since: number | null }

export interface Devices { lights: Lights; tempF: number; tv: boolean; shades: 'open' | 'closed' }

export const DEFAULT_HOUSEKEEPING: Housekeeping = { mode: 'none', window: 'any', turndown: true, since: null }
export const DEFAULT_DEVICES: Devices = { lights: 'bright', tempF: 72, tv: false, shades: 'open' }

const isEnum = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d)

export function normalizeHousekeeping(raw: unknown): Housekeeping {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    mode: isEnum(SERVICE_MODES, o.mode, 'none'), window: isEnum(CLEANING_WINDOWS, o.window, 'any'),
    turndown: o.turndown === undefined ? true : o.turndown === true, since: typeof o.since === 'number' ? o.since : null,
  }
}

export function normalizeDevices(raw: unknown): Devices {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const temp = typeof o.tempF === 'number' && Number.isFinite(o.tempF) ? Math.round(o.tempF) : DEFAULT_DEVICES.tempF
  return {
    lights: isEnum(LIGHTS, o.lights, 'bright'), tempF: Math.min(TEMP_RANGE.max, Math.max(TEMP_RANGE.min, temp)),
    tv: o.tv === true, shades: o.shades === 'closed' ? 'closed' : 'open',
  }
}

export type RoomProblem = 'badMode' | 'badWindow' | 'badLights' | 'badTemp' | 'noView'

export function housekeepingProblem(p: Partial<Housekeeping>): RoomProblem | null {
  if (p.mode !== undefined && !SERVICE_MODES.includes(p.mode)) return 'badMode'
  if (p.window !== undefined && !CLEANING_WINDOWS.includes(p.window)) return 'badWindow'
  return null
}

export function devicesProblem(p: Partial<Devices>, view: boolean): RoomProblem | null {
  if (p.lights !== undefined && !LIGHTS.includes(p.lights)) return 'badLights'
  if (p.tempF !== undefined && (!Number.isFinite(p.tempF) || p.tempF < TEMP_RANGE.min || p.tempF > TEMP_RANGE.max)) return 'badTemp'
  if (p.shades !== undefined && (p.shades !== 'open' && p.shades !== 'closed' || (!view && p.shades === 'closed'))) return 'noView'
  return null
}

/** After this many hours of Do Not Disturb the steward checks on the guest (a safety rule on many ships). */
export const DND_CHECK_HOURS = 24

export const dndCheckDue = (h: Housekeeping, now: number): boolean => h.mode === 'dnd' && h.since !== null && now - h.since >= DND_CHECK_HOURS * 3_600_000
