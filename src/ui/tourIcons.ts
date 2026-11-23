import type { ComponentType } from 'react'
import type { TourStep } from '../tour/steps'
import { Activity, Anchor, Ask, Bell, Bookmark, Clock, CloudSun, Compass, Document, Help, Info, Lightbulb, Me, Menu, MessagesSquare, Plan, RouteMap, Search, Settings, Ship, ShipExplorer, ShoppingBag, Ticket, Users, UtensilsCrossed, Wallet, Waves, Wifi, ClipboardList } from './icons'

type IconType = ComponentType<{ 'aria-hidden'?: boolean | 'true' | 'false'; className?: string }>

/** The picture beside a tour step's title. The ones for the top bar (chat, today, explorers, weather, navigation, itinerary) are the same icons the bar shows (`TestBar.tsx`). */
export const TOUR_ICONS: Record<TourStep['icon'], IconType> = {
  nav: Menu, search: Search, stanley: Ask, help: Help, menu: Menu, date: Plan, header: Info, tip: Lightbulb, chat: MessagesSquare, today: Plan,
  explorers: ShipExplorer, weather: CloudSun, navigation: Compass, itinerary: RouteMap, pin: Bookmark, pass: Ticket, bill: Wallet, clock: Clock,
  ship: Ship, anchor: Anchor, waves: Waves, pack: ClipboardList, me: Me, settings: Settings, bell: Bell, doc: Document, wallet: Wallet,
  food: UtensilsCrossed, stats: Activity, people: Users, wifi: Wifi, cart: ShoppingBag, list: ClipboardList,
}
