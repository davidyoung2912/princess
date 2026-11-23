import { Ask, Cabin, Chat, Compass, DoorOpen, HeartPulse, ClipboardList, Images, MapPin, Me, Plan, Plane, QrCode, Ship, Sparkles, Star, Sun, Ticket, Trip, Users, Wallet, Anchor, Home } from './icons'

/** One icon per tab name, the same at every stage a tab appears in. */
export const TAB_ICONS: Record<string, typeof Home> = {
  home: Home, me: Me, plan: Plan, ship: Ship, explore: Compass, ask: Ask, sailing: Anchor, cabin: Cabin, cost: Wallet, booking: Ticket, travellers: Users,
  pay: Wallet, trip: Trip, needs: HeartPulse, group: Users, prepare: ClipboardList, board: QrCode, travel: Plane, today: Sun, people: Users, port: MapPin,
  leave: DoorOpen, memories: Images, next: Sparkles, feedback: Star,
}
export const FALLBACK_ICON = Chat
